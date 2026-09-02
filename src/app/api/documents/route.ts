import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  deleteWorkspaceDocument,
  listWorkspaceDocuments,
  uploadWorkspaceDocument,
} from '@/lib/data/documents';
import {
  MAX_DOCUMENT_BYTES,
  resolveDocumentType,
} from '@/lib/documents/extract-text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const deleteSchema = z.object({
  id: z.string().min(1).max(100),
});

function errorResponse(message: string, status: number, code: string) {
  return Response.json({ error: { message, code } }, { status });
}

export async function GET() {
  const { data: workspace, error } = await getWorkspaceContext();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  try {
    const documents = await listWorkspaceDocuments(workspace);
    return Response.json({ documents });
  } catch {
    return errorResponse(
      'Unable to load company documents.',
      500,
      'DOCUMENT_LIST_FAILED',
    );
  }
}

export async function POST(request: Request) {
  const { data: workspace, error } = await getWorkspaceContext();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Invalid upload request.', 400, 'INVALID_UPLOAD');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return errorResponse('Choose a document to upload.', 400, 'FILE_REQUIRED');
  }
  if (!file.name.trim() || file.name.length > 240) {
    return errorResponse('The document name is invalid.', 400, 'INVALID_FILE_NAME');
  }
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) {
    return errorResponse(
      'Documents must be between 1 byte and 10 MB.',
      400,
      'INVALID_FILE_SIZE',
    );
  }

  const mimeType = resolveDocumentType(file.name, file.type);
  if (!mimeType) {
    return errorResponse(
      'Supported files are PDF, DOCX, TXT, Markdown, CSV, and JSON.',
      415,
      'UNSUPPORTED_FILE_TYPE',
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const document = await uploadWorkspaceDocument(workspace, {
      name: file.name.trim(),
      mimeType,
      sizeBytes: file.size,
      bytes,
    });
    return Response.json({ document }, { status: 201 });
  } catch (caught) {
    console.error('Document upload failed', caught);
    return errorResponse(
      caught instanceof Error ? caught.message : 'Unable to upload the document.',
      500,
      'DOCUMENT_UPLOAD_FAILED',
    );
  }
}

export async function DELETE(request: Request) {
  const { data: workspace, error } = await getWorkspaceContext();
  if (!workspace || error) {
    return errorResponse(
      error.message,
      error.status ?? 401,
      error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      'Invalid document deletion request.',
      400,
      'INVALID_DOCUMENT_DELETE',
    );
  }

  try {
    await deleteWorkspaceDocument(workspace, parsed.data.id);
    return Response.json({ deleted: true, id: parsed.data.id });
  } catch (caught) {
    return errorResponse(
      caught instanceof Error ? caught.message : 'Unable to delete the document.',
      403,
      'DOCUMENT_DELETE_FAILED',
    );
  }
}
