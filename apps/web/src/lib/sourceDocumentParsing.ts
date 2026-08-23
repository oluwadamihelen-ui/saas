import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export class UnsupportedSourceDocumentError extends Error {
  constructor(message = "Only PDF, DOCX, and TXT files are supported.") {
    super(message);
  }
}

export class EmptySourceDocumentError extends Error {
  constructor() {
    super("We couldn't find any text in that file — it may be empty, scanned images, or password-protected.");
  }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    // .text glues pages together with a "-- N of M --" marker meant for
    // human debugging output, not a document body — join the per-page text
    // ourselves instead.
    return result.pages.map((page) => page.text.trim()).join("\n\n");
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extracts plain text from an uploaded source document for Adaptation
 * Mode (spec's adaptation pipeline). Keyed off the file extension rather
 * than the browser-supplied MIME type, which varies inconsistently across
 * browsers/OSes for the same file.
 */
export async function extractSourceDocumentText(buffer: Buffer, filename: string): Promise<string> {
  const ext = extensionOf(filename);
  let text: string;

  switch (ext) {
    case "txt":
      text = buffer.toString("utf-8");
      break;
    case "pdf":
      text = await extractPdfText(buffer);
      break;
    case "docx":
      text = await extractDocxText(buffer);
      break;
    default:
      throw new UnsupportedSourceDocumentError();
  }

  const trimmed = text.trim();
  if (!trimmed) throw new EmptySourceDocumentError();
  return trimmed;
}
