import 'server-only';

import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARACTERS = 500_000;

export const supportedDocumentTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
] as const;

const extensionTypes: Record<string, (typeof supportedDocumentTypes)[number]> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
};

export function resolveDocumentType(name: string, reportedType: string) {
  const normalizedType = reportedType.toLowerCase().split(';')[0].trim();
  if (
    supportedDocumentTypes.includes(
      normalizedType as (typeof supportedDocumentTypes)[number],
    )
  ) {
    return normalizedType as (typeof supportedDocumentTypes)[number];
  }

  const extension = name.split('.').pop()?.toLowerCase() || '';
  return extensionTypes[extension] ?? null;
}

function cleanExtractedText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, MAX_EXTRACTED_CHARACTERS);
}

function ensurePdfSignature(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('The uploaded file is not a valid PDF.');
  }
}

function ensureDocxSignature(bytes: Buffer) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('The uploaded file is not a valid DOCX document.');
  }
}

export async function extractDocumentText(
  bytes: Buffer,
  mimeType: (typeof supportedDocumentTypes)[number],
) {
  if (mimeType === 'application/pdf') {
    ensurePdfSignature(bytes);
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return cleanExtractedText(result.text);
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    ensureDocxSignature(bytes);
    const result = await mammoth.extractRawText({ buffer: bytes });
    return cleanExtractedText(result.value);
  }

  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (mimeType === 'application/json') JSON.parse(text);
  return cleanExtractedText(text);
}
