/**
 * Document parser service for extracting text from PDF, DOCX, and TXT files.
 *
 * - TXT:  Read via File.text() (UTF-8).
 * - PDF:  Read via File.arrayBuffer() → Latin-1 string → regex text extraction.
 * - DOCX: Read via File.arrayBuffer() → fflate.unzipSync() → parse word/document.xml.
 *
 * Uses expo-file-system (SDK 57 File API) for file I/O.
 */

import { inflateSync, unzipSync, unzlibSync } from 'fflate';

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

type CMap = Record<string, string>;

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
 */
const arrayBufferToLatin1 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    parts.push(String.fromCharCode(...chunk));
  }
  return parts.join('');
};

/**
 * Decode a Uint8Array to an ASCII / Latin-1 string.
 */
const uint8ArrayToAscii = (arr: Uint8Array): string => {
  const chunkSize = 8192;
  const parts: string[] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, Math.min(i + chunkSize, arr.length));
    parts.push(String.fromCharCode(...chunk));
  }
  return parts.join('');
};

/**
 * Decode a Uint8Array to a UTF-8 string.
 */
const uint8ArrayToString = (arr: Uint8Array): string => {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(arr);
  }
  return decodeURIComponent(escape(uint8ArrayToAscii(arr)));
};

/**
 * Find byte sequence pattern in a Uint8Array.
 */
const findSequence = (
  bytes: Uint8Array,
  pattern: number[],
  startIndex: number,
): number => {
  const pLen = pattern.length;
  const limit = bytes.length - pLen;
  for (let i = startIndex; i <= limit; i++) {
    if (bytes[i] === pattern[0]) {
      let match = true;
      for (let j = 1; j < pLen; j++) {
        if (bytes[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
  }
  return -1;
};

/* -------------------------------------------------------------------------- */
/*  PDF CMap and Text Decoding                                                 */
/* -------------------------------------------------------------------------- */

const parseCMap = (cmapContent: string, cMap: CMap): void => {
  // Parse beginbfchar ... endbfchar
  const bfCharRegex = /beginbfchar\s*([\s\S]*?)\s*endbfchar/gi;
  let charMatch: RegExpExecArray | null;
  while ((charMatch = bfCharRegex.exec(cmapContent)) !== null) {
    const block = charMatch[1];
    const pairRegex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g;
    let pair: RegExpExecArray | null;
    while ((pair = pairRegex.exec(block)) !== null) {
      const src = pair[1].toUpperCase();
      const dstHex = pair[2];
      let dstStr = '';
      for (let i = 0; i < dstHex.length; i += 4) {
        const hex4 = dstHex.slice(i, i + 4);
        if (hex4.length === 4) {
          dstStr += String.fromCharCode(parseInt(hex4, 16));
        } else if (hex4.length === 2) {
          dstStr += String.fromCharCode(parseInt(hex4, 16));
        }
      }
      cMap[src] = dstStr;
    }
  }

  // Parse beginbfrange ... endbfrange
  const bfRangeRegex = /beginbfrange\s*([\s\S]*?)\s*endbfrange/gi;
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = bfRangeRegex.exec(cmapContent)) !== null) {
    const block = rangeMatch[1];
    // Form 1: <start> <end> <destStart>
    const range1Regex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g;
    let r1: RegExpExecArray | null;
    while ((r1 = range1Regex.exec(block)) !== null) {
      const start = parseInt(r1[1], 16);
      const end = parseInt(r1[2], 16);
      const dstStart = parseInt(r1[3], 16);
      const codeLen = r1[1].length;
      for (let c = start; c <= end; c++) {
        const key = c.toString(16).toUpperCase().padStart(codeLen, '0');
        cMap[key] = String.fromCharCode(dstStart + (c - start));
      }
    }

    // Form 2: <start> <end> [ <dest1> <dest2> ... ]
    const range2Regex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[([^\]]+)\]/g;
    let r2: RegExpExecArray | null;
    while ((r2 = range2Regex.exec(block)) !== null) {
      const start = parseInt(r2[1], 16);
      const end = parseInt(r2[2], 16);
      const codeLen = r2[1].length;
      const destList = r2[3].match(/<([0-9a-fA-F]+)>/g) || [];
      for (let i = 0; i < destList.length && start + i <= end; i++) {
        const key = (start + i).toString(16).toUpperCase().padStart(codeLen, '0');
        const hexVal = destList[i].replace(/[<>]/g, '');
        let s = '';
        for (let j = 0; j < hexVal.length; j += 4) {
          s += String.fromCharCode(parseInt(hexVal.slice(j, j + 4), 16));
        }
        cMap[key] = s;
      }
    }
  }
};

const decodeHexText = (hex: string, cMap: CMap): string => {
  const clean = hex.replace(/\s+/g, '');
  if (!clean) return '';

  const upper = clean.toUpperCase();

  // 1. Direct CMap lookup
  if (cMap[upper]) {
    return cMap[upper];
  }

  // 2. Multi-character CMap lookup (e.g. 4-digit glyph codes)
  if (Object.keys(cMap).length > 0 && clean.length >= 4) {
    let matched = '';
    let allMatched = true;
    for (let i = 0; i < clean.length; i += 4) {
      const part = clean.slice(i, i + 4).toUpperCase();
      if (cMap[part] !== undefined) {
        matched += cMap[part];
      } else {
        allMatched = false;
        break;
      }
    }
    if (allMatched && matched.length > 0) {
      return matched;
    }
  }

  // 3. UTF-16BE detection (e.g. FEFF... or 00xx00yy...)
  if (clean.length >= 4 && clean.length % 4 === 0) {
    if (upper.startsWith('FEFF')) {
      let s = '';
      for (let i = 4; i < clean.length; i += 4) {
        s += String.fromCharCode(parseInt(clean.slice(i, i + 4), 16));
      }
      return s;
    }
    let isUtf16 = true;
    for (let i = 0; i < clean.length; i += 4) {
      if (clean.slice(i, i + 2) !== '00') {
        isUtf16 = false;
        break;
      }
    }
    if (isUtf16) {
      let s = '';
      for (let i = 0; i < clean.length; i += 4) {
        s += String.fromCharCode(parseInt(clean.slice(i + 2, i + 4), 16));
      }
      return s;
    }
  }

  // 4. Default: decode pairs of hex characters as ASCII/Latin-1
  let result = '';
  for (let i = 0; i < clean.length; i += 2) {
    const byteHex = clean.slice(i, i + 2);
    if (byteHex.length === 2) {
      const code = parseInt(byteHex, 16);
      if (!isNaN(code)) {
        result += String.fromCharCode(code);
      }
    }
  }
  return result;
};

const unescapePdfLiteral = (raw: string): string => {
  // UTF-16BE BOM: \xFE\xFF
  if (raw.charCodeAt(0) === 0xfe && raw.charCodeAt(1) === 0xff) {
    let s = '';
    for (let i = 2; i + 1 < raw.length; i += 2) {
      s += String.fromCharCode((raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1));
    }
    return s;
  }

  return raw
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\\r?\n/g, '');
};

/* -------------------------------------------------------------------------- */
/*  PDF Stream Decompression & Content Parsing                                 */
/* -------------------------------------------------------------------------- */

const decompressPdfStreams = (
  buffer: ArrayBuffer,
): { textStreams: string[]; cMap: CMap } => {
  const bytes = new Uint8Array(buffer);
  const textStreams: string[] = [];
  const cMap: CMap = {};

  const streamPattern = [115, 116, 114, 101, 97, 109]; // 'stream'
  const endStreamPattern = [101, 110, 100, 115, 116, 114, 101, 97, 109]; // 'endstream'

  let pos = 0;
  while (pos < bytes.length - 10) {
    const streamPos = findSequence(bytes, streamPattern, pos);
    if (streamPos === -1) break;

    const prevByte = streamPos > 0 ? bytes[streamPos - 1] : 0x0a;
    const isDelimiter =
      prevByte === 0x20 ||
      prevByte === 0x0a ||
      prevByte === 0x0d ||
      prevByte === 0x3e ||
      prevByte === 0x09;

    if (!isDelimiter) {
      pos = streamPos + 6;
      continue;
    }

    let start = streamPos + 6;
    if (bytes[start] === 0x0d && bytes[start + 1] === 0x0a) {
      start += 2;
    } else if (bytes[start] === 0x0a || bytes[start] === 0x0d) {
      start += 1;
    }

    const endPos = findSequence(bytes, endStreamPattern, start);
    if (endPos === -1) break;

    let end = endPos;
    if (end > start && bytes[end - 1] === 0x0a) end--;
    if (end > start && bytes[end - 1] === 0x0d) end--;

    // Look back at stream dictionary
    const dictStart = Math.max(0, streamPos - 400);
    const dictChunk = bytes.subarray(dictStart, streamPos);
    let dictStr = '';
    for (let i = 0; i < dictChunk.length; i++) {
      dictStr += String.fromCharCode(dictChunk[i]);
    }

    const isImage = /\/Subtype\s*\/Image/i.test(dictStr);
    const isFlate = /\/Filter\s*(\[\s*)?\/Fl(ateDecode)?/i.test(dictStr);
    const isToUnicode = /\/ToUnicode/i.test(dictStr);

    if (!isImage && end > start) {
      const slice = bytes.subarray(start, end);
      let decompressed: Uint8Array | null = null;

      if (isFlate) {
        try {
          decompressed = unzlibSync(slice);
        } catch {
          try {
            decompressed = inflateSync(slice);
          } catch {
            decompressed = null;
          }
        }
      } else {
        decompressed = slice;
      }

      if (decompressed && decompressed.length > 0) {
        const streamText = uint8ArrayToAscii(decompressed);
        if (
          isToUnicode ||
          streamText.includes('beginbfchar') ||
          streamText.includes('beginbfrange')
        ) {
          parseCMap(streamText, cMap);
        } else {
          textStreams.push(streamText);
        }
      }
    }

    pos = endPos + 9;
  }

  return { textStreams, cMap };
};

const parseBlockText = (block: string, cMap: CMap): string => {
  const parts: string[] = [];

  // 1. Process TJ arrays: [(text) num (text) <hex>] TJ
  const tjArrayRegex = /\[((?:[^\]\\]|\\.)*)\]\s*TJ/gi;
  let tjMatch: RegExpExecArray | null;
  while ((tjMatch = tjArrayRegex.exec(block)) !== null) {
    const inner = tjMatch[1];
    // Tokenize literal strings, hex strings, and kerning numbers
    const tokenRegex = /\(((?:[^()\\]|\\.)*)\)|<([0-9a-fA-F\s]+)>|(-?[0-9]+(?:\.[0-9]+)?)/g;
    let token: RegExpExecArray | null;
    let arrayText = '';

    while ((token = tokenRegex.exec(inner)) !== null) {
      if (token[1] !== undefined) {
        arrayText += unescapePdfLiteral(token[1]);
      } else if (token[2] !== undefined) {
        arrayText += decodeHexText(token[2], cMap);
      } else if (token[3] !== undefined) {
        const spacing = parseFloat(token[3]);
        if (spacing <= -120 && !arrayText.endsWith(' ')) {
          arrayText += ' ';
        }
      }
    }

    if (arrayText.trim()) {
      parts.push(arrayText.trim());
    }
  }

  // 2. Process literal strings with Tj / ' / "
  const tjLiteralRegex = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g;
  let literalMatch: RegExpExecArray | null;
  while ((literalMatch = tjLiteralRegex.exec(block)) !== null) {
    const text = unescapePdfLiteral(literalMatch[1]);
    if (text.trim() && !parts.includes(text.trim())) {
      parts.push(text.trim());
    }
  }

  // 3. Process hex strings with Tj / ' / "
  const tjHexRegex = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/g;
  let hexMatch: RegExpExecArray | null;
  while ((hexMatch = tjHexRegex.exec(block)) !== null) {
    const text = decodeHexText(hexMatch[1], cMap);
    if (text.trim() && !parts.includes(text.trim())) {
      parts.push(text.trim());
    }
  }

  return parts.join(' ');
};

const extractTextFromStreams = (streams: string[], cMap: CMap): string => {
  const blocks: string[] = [];

  for (const stream of streams) {
    const streamBlocks: string[] = [];
    const btRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let btMatch: RegExpExecArray | null;
    let foundBt = false;

    while ((btMatch = btRegex.exec(stream)) !== null) {
      foundBt = true;
      const text = parseBlockText(btMatch[1], cMap);
      if (text.trim()) {
        streamBlocks.push(text.trim());
      }
    }

    if (!foundBt) {
      const text = parseBlockText(stream, cMap);
      if (text.trim()) {
        streamBlocks.push(text.trim());
      }
    }

    if (streamBlocks.length > 0) {
      blocks.push(streamBlocks.join('\n'));
    }
  }

  return blocks.join('\n\n').trim();
};

/**
 * Fallback extractor for uncompressed or raw PDF strings.
 */
const extractTextFromPdfRaw = (raw: string, cMap: CMap): string => {
  const textFragments: string[] = [];

  // TJ arrays
  const tjArrayRegex = /\[((?:[^\]\\]|\\.)*)\]\s*TJ/gi;
  let match: RegExpExecArray | null;
  while ((match = tjArrayRegex.exec(raw)) !== null) {
    const inner = match[1];
    const tokenRegex = /\(((?:[^()\\]|\\.)*)\)|<([0-9a-fA-F\s]+)>/g;
    let t: RegExpExecArray | null;
    while ((t = tokenRegex.exec(inner)) !== null) {
      if (t[1] !== undefined) {
        textFragments.push(unescapePdfLiteral(t[1]));
      } else if (t[2] !== undefined) {
        textFragments.push(decodeHexText(t[2], cMap));
      }
    }
  }

  // Literal Tj
  const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g;
  while ((match = tjRegex.exec(raw)) !== null) {
    if (match[1]) {
      textFragments.push(unescapePdfLiteral(match[1]));
    }
  }

  // Hex Tj
  const hexRegex = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/g;
  while ((match = hexRegex.exec(raw)) !== null) {
    if (match[1]) {
      textFragments.push(decodeHexText(match[1], cMap));
    }
  }

  return textFragments.join(' ').replace(/\s{2,}/g, ' ').trim();
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

    // 1. Decompress FlateDecode streams and parse CMap (handles 95%+ of modern PDFs)
    const { textStreams, cMap } = decompressPdfStreams(buffer);
    let text = extractTextFromStreams(textStreams, cMap);

    // 2. If no text was found from streams, fallback to raw uncompressed parsing
    if (!text) {
      text = extractTextFromPdfRaw(raw, cMap);
    }

    // Normalize spacing while preserving paragraph breaks
    text = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

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
