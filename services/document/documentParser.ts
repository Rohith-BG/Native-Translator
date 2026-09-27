/**
 * Document parser service for extracting text from PDF, DOCX, and TXT files.
 *
 * - TXT:  Read via File.text() (UTF-8).
 * - PDF:  Read via File.arrayBuffer() → Latin-1 string → regex text extraction.
 * - DOCX: Read via File.arrayBuffer() → fflate.unzipSync() → parse word/document.xml.
 *
 * Uses expo-file-system (SDK 57 File API) for file I/O.
 */

import { unzipSync } from 'fflate';

/* -------------------------------------------------------------------------- */
/*  Safe import of expo-file-system                                            */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FileClass: (new (...uris: string[]) => {
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
  readonly exists: boolean;
}) | null = null;

let fileSystemAvailable = true;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-file-system');
  FileClass = mod.File ?? null;
} catch {
  fileSystemAvailable = false;
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SupportedDocType = 'txt' | 'pdf' | 'docx' | 'unknown';

export interface DocumentInfo {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  docType: SupportedDocType;
}

export interface ParsedDocument {
  text: string;
  pageCount: number;
  info: DocumentInfo;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const detectDocType = (name: string, mimeType?: string): SupportedDocType => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'txt' || mimeType === 'text/plain') return 'txt';
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (
    ext === 'docx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  return 'unknown';
};

/**
 * Convert an ArrayBuffer to a Latin-1 (ISO 8859-1) string.
 * Each byte becomes one char — this preserves binary values 0-255
 * so regex-based text extraction works on PDF binary content.
 */
const arrayBufferToLatin1 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  // Process in chunks to avoid stack overflow on large files
  const chunkSize = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    parts.push(String.fromCharCode(...chunk));
  }
  return parts.join('');
};

/**
 * Decode a Uint8Array to a UTF-8 string.
 */
const uint8ArrayToString = (arr: Uint8Array): string => {
  // TextDecoder should be available in Hermes (RN 0.86+)
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(arr);
  }
  // Fallback for older environments
  const chunkSize = 8192;
  const parts: string[] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, Math.min(i + chunkSize, arr.length));
    parts.push(String.fromCharCode(...chunk));
  }
  return decodeURIComponent(escape(parts.join('')));
};

/* -------------------------------------------------------------------------- */
/*  PDF text extraction                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Extracts readable text from a PDF's raw Latin-1 content.
 *
 * PDF text streams contain operators like `(text) Tj` or `<hex> Tj`.
 * This is a best-effort extractor for text-based PDFs — scanned/image
 * PDFs won't yield text (use OCR instead).
 */
const extractTextFromPdfRaw = (raw: string): string => {
  const textFragments: string[] = [];

  // Match text within parentheses followed by Tj/TJ operators
  const tjRegex = /\(([^)]*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(raw)) !== null) {
    if (match[1]) {
      textFragments.push(match[1]);
    }
  }

  // Match TJ arrays: [(text) num (text) ...] TJ
  const tjArrayRegex = /\[([^\]]*)\]\s*TJ/gi;
  while ((match = tjArrayRegex.exec(raw)) !== null) {
    const inner = match[1];
    const innerParens = /\(([^)]*)\)/g;
    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = innerParens.exec(inner)) !== null) {
      if (innerMatch[1]) {
        textFragments.push(innerMatch[1]);
      }
    }
  }

  // Also try BT...ET blocks with Td/Tm positioning + text show operators
  // This catches more text in PDFs that use complex text positioning
  const btRegex = /BT\s([\s\S]*?)ET/g;
  while ((match = btRegex.exec(raw)) !== null) {
    const block = match[1];
    const textOps = /\(([^)]+)\)\s*(?:Tj|TJ|'|")/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textOps.exec(block)) !== null) {
      if (textMatch[1] && !textFragments.includes(textMatch[1])) {
        textFragments.push(textMatch[1]);
      }
    }
  }

  if (textFragments.length === 0) {
    return '';
  }

  // Unescape common PDF escape sequences
  const unescapePdf = (s: string): string =>
    s
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');

  return textFragments
    .map(unescapePdf)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/**
 * Estimates page count from PDF raw content by counting /Type /Page entries.
 */
const estimatePdfPageCount = (raw: string): number => {
  const pages = raw.match(/\/Type\s*\/Page[^s]/g);
  return pages ? pages.length : 1;
};

/* -------------------------------------------------------------------------- */
/*  DOCX text extraction                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Extracts text from a DOCX file by unzipping it and parsing
 * the word/document.xml content for <w:t> text nodes.
 */
const extractTextFromDocx = (buffer: ArrayBuffer): string => {
  const data = new Uint8Array(buffer);

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    return '';
  }

  // Find word/document.xml (case-insensitive lookup)
  let documentXml = '';
  for (const [path, content] of Object.entries(files)) {
    if (path.toLowerCase() === 'word/document.xml') {
      documentXml = uint8ArrayToString(content);
      break;
    }
  }

  if (!documentXml) {
    return '';
  }

  // Extract text from <w:t> tags
  const textFragments: string[] = [];
  const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = wtRegex.exec(documentXml)) !== null) {
    if (match[1] !== undefined) {
      textFragments.push(match[1]);
    }
  }

  if (textFragments.length > 0) {
    // Reconstruct text: <w:t> tags within the same <w:r> are concatenated,
    // and paragraph breaks (<w:p>) add newlines.
    // Simple approach: join with space, then clean up
    return textFragments.join(' ').replace(/\s{2,}/g, ' ').trim();
  }

  return '';
};

/* -------------------------------------------------------------------------- */
/*  Service class                                                              */
/* -------------------------------------------------------------------------- */

class DocumentParser {
  isAvailable(): boolean {
    return fileSystemAvailable && FileClass !== null;
  }

  buildDocumentInfo(
    uri: string,
    name: string,
    size: number,
    mimeType?: string,
  ): DocumentInfo {
    return {
      uri,
      name,
      size,
      mimeType: mimeType ?? 'application/octet-stream',
      docType: detectDocType(name, mimeType),
    };
  }

  async parse(info: DocumentInfo): Promise<ParsedDocument> {
    if (!FileClass) {
      throw new Error('File system is not available. Use a native development build.');
    }

    switch (info.docType) {
      case 'txt':
        return this.parseTxt(info);
      case 'pdf':
        return this.parsePdf(info);
      case 'docx':
        return this.parseDocx(info);
      default:
        throw new Error(
          `Unsupported file type: "${info.name}". Supported formats are .txt, .pdf, and .docx.`,
        );
    }
  }

  private async parseTxt(info: DocumentInfo): Promise<ParsedDocument> {
    const file = new FileClass!(info.uri);
    const text = await file.text();

    if (!text.trim()) {
      throw new Error('The file is empty — no text to translate.');
    }

    return {
      text: text.trim(),
      pageCount: 1,
      info,
    };
  }

  private async parsePdf(info: DocumentInfo): Promise<ParsedDocument> {
    const file = new FileClass!(info.uri);

    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      throw new Error('Unable to read the PDF file. It may be corrupted or encrypted.');
    }

    // Convert to Latin-1 string to preserve all byte values for regex extraction
    const raw = arrayBufferToLatin1(buffer);

    // Verify it's actually a PDF
    if (!raw.startsWith('%PDF')) {
      throw new Error('This file does not appear to be a valid PDF.');
    }

    const text = extractTextFromPdfRaw(raw);
    const pageCount = estimatePdfPageCount(raw);

    if (!text) {
      throw new Error(
        'No readable text found in this PDF. It may be a scanned document — try the Camera tab to OCR it instead.',
      );
    }

    return { text, pageCount, info };
  }

  private async parseDocx(info: DocumentInfo): Promise<ParsedDocument> {
    const file = new FileClass!(info.uri);

    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      throw new Error('Unable to read the DOCX file. It may be corrupted.');
    }

    // Verify it starts with a ZIP signature (PK\x03\x04)
    const header = new Uint8Array(buffer, 0, 4);
    if (header[0] !== 0x50 || header[1] !== 0x4B || header[2] !== 0x03 || header[3] !== 0x04) {
      throw new Error('This file does not appear to be a valid DOCX document.');
    }

    const text = extractTextFromDocx(buffer);

    if (!text) {
      throw new Error(
        'No readable text found in this DOCX file. It may contain only images or embedded objects.',
      );
    }

    // Estimate pages (~250 words per page)
    const wordCount = text.split(/\s+/).length;
    const pageCount = Math.max(1, Math.ceil(wordCount / 250));

    return { text, pageCount, info };
  }
}

export const documentParser = new DocumentParser();
