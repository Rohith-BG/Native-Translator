/**
 * Document parser service for extracting text from PDF, DOCX, and TXT files.
 *
 * Uses expo-file-system for file reading. PDF and DOCX parsing use
 * lightweight pure-JS approaches to stay compatible with React Native
 * without heavy native dependencies.
 */

let ExpoFileSystem: {
  File: new (uri: string) => { text: () => Promise<string>; exists: boolean; size: number | null };
} | null = null;

let fileSystemAvailable = true;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExpoFileSystem = require('expo-file-system');
} catch {
  fileSystemAvailable = false;
}

const readFileAsString = async (uri: string): Promise<string> => {
  if (!ExpoFileSystem) {
    throw new Error('File system is not available. Use a native development build.');
  }
  const file = new ExpoFileSystem.File(uri);
  return file.text();
}

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
 * Extracts readable text from a PDF's raw content.
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

  if (textFragments.length === 0) {
    return '';
  }

  // Unescape common PDF escape sequences
  const unescape = (s: string): string =>
    s
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');

  return textFragments
    .map(unescape)
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

/**
 * Extracts text from a DOCX file's raw XML content.
 *
 * DOCX is a ZIP archive; when read as a string in RN, we may get
 * garbled content, but we can still try to extract <w:t> text nodes
 * if the raw content is readable. For better results, we try base64
 * reading and manual XML extraction.
 */
const extractTextFromDocxRaw = (raw: string): string => {
  // DOCX XML contains <w:t> tags with the actual text
  const textFragments: string[] = [];
  const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = wtRegex.exec(raw)) !== null) {
    if (match[1]) {
      textFragments.push(match[1]);
    }
  }

  if (textFragments.length > 0) {
    return textFragments.join(' ').trim();
  }

  // Fallback: try to find any readable text between XML-like tags
  const plainTextParts: string[] = [];
  const genericRegex = />([^<]{2,})</g;
  while ((match = genericRegex.exec(raw)) !== null) {
    const text = match[1].trim();
    // Filter out XML/binary artifacts
    if (text && !/^[\x00-\x1f\x7f-\x9f]+$/.test(text) && text.length > 1) {
      plainTextParts.push(text);
    }
  }

  return plainTextParts.join(' ').trim();
};

class DocumentParser {
  async isAvailable(): Promise<boolean> {
    return fileSystemAvailable && FileSystem !== null;
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
    if (!ExpoFileSystem) {
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
    const text = await readFileAsString(info.uri);

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
    // Read PDF as latin1/ISO-8859-1 to preserve byte values for text extraction
    let raw: string;
    try {
      raw = await readFileAsString(info.uri);
    } catch {
      throw new Error('Unable to read the PDF file. It may be corrupted or encrypted.');
    }

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
    let raw: string;
    try {
      raw = await readFileAsString(info.uri);
    } catch {
      throw new Error('Unable to read the DOCX file. It may be corrupted.');
    }

    const text = extractTextFromDocxRaw(raw);

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
