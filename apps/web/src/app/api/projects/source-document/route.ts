import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";
import { storageClient } from "@/lib/storage";
import { extractSourceDocumentText, UnsupportedSourceDocumentError, EmptySourceDocumentError } from "@/lib/sourceDocumentParsing";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — generous for a screenplay/novel manuscript, small enough to parse synchronously in the request.

/**
 * Adaptation Mode's file upload: parses a PDF/DOCX/TXT source document into
 * plain text for the story wizard, and separately persists the original
 * file to storage under `sourceFileKey` (spec's adaptation pipeline) for
 * the record — the parsed text is what actually feeds story generation.
 * Runs synchronously (no queue/job) since parsing a manuscript-sized
 * document takes well under a request timeout, unlike the AI generation
 * pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "That file is too large — the limit is 20MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let text: string;
    try {
      text = await extractSourceDocumentText(buffer, file.name);
    } catch (error) {
      if (error instanceof UnsupportedSourceDocumentError || error instanceof EmptySourceDocumentError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const sourceFileKey = `source-uploads/${userId}/${randomUUID()}.${ext}`;
    await storageClient.putObject(sourceFileKey, buffer, file.type || "application/octet-stream");

    return NextResponse.json({ text, sourceFileKey });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
