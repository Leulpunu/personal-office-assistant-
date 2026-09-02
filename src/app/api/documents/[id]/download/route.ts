import { getWorkspaceContext } from '@/lib/auth/workspace';
import { downloadWorkspaceDocument } from '@/lib/data/documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeDownloadName(name: string) {
  return name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
}

export async function GET(
  _request: Request,
  context: RouteContext<'/api/documents/[id]/download'>,
) {
  const { data: workspace, error } = await getWorkspaceContext();
  if (!workspace || error) {
    return Response.json(
      {
        error: {
          message: error.message,
          code: error.code ?? 'WORKSPACE_ACCESS_DENIED',
        },
      },
      { status: error.status ?? 401 },
    );
  }

  const { id } = await context.params;
  try {
    const { document, blob } = await downloadWorkspaceDocument(workspace, id);
    const encodedName = encodeURIComponent(document.name);
    return new Response(blob, {
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Length': String(blob.size),
        'Content-Disposition':
          'attachment; filename="' +
          safeDownloadName(document.name) +
          '"; filename*=UTF-8\'\'' +
          encodedName,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return Response.json(
      { error: { message: 'Document not found.', code: 'DOCUMENT_NOT_FOUND' } },
      { status: 404 },
    );
  }
}
