import 'server-only';

import { randomUUID } from 'node:crypto';
import type { WorkspaceContext } from '@/lib/auth/workspace';
import {
  extractDocumentText,
  type supportedDocumentTypes,
} from '@/lib/documents/extract-text';
import type {
  DocumentRecordDTO,
  DocumentSearchResultDTO,
  DocumentStatus,
} from '@/types/documents';

const documentColumns =
  'id, name, mime_type, size_bytes, uploaded_by, created_at, status, extraction_error';
const documentDetailColumns =
  'id, name, mime_type, size_bytes, uploaded_by, created_at, status, extraction_error, storage_path, content_text';
const storageBucket = 'company-documents';

type SupportedDocumentType = (typeof supportedDocumentTypes)[number];

type UploadDocumentInput = {
  name: string;
  mimeType: SupportedDocumentType;
  sizeBytes: number;
  bytes: Buffer;
};

type DocumentDetail = DocumentRecordDTO & {
  storagePath: string;
  contentText: string;
};

const demoFiles = new Map<string, { bytes: Buffer; record: DocumentDetail }>();

function initialDemoDocuments(): DocumentDetail[] {
  return [
    {
      id: 'demo-document-1',
      name: 'Supplier Agreement 2026.txt',
      mimeType: 'text/plain',
      sizeBytes: 4_820,
      uploadedBy: 'demo-user',
      createdAt: '2026-08-24T09:30:00.000Z',
      status: 'ready',
      extractionError: null,
      storagePath: 'demo/supplier-agreement-2026.txt',
      contentText:
        'Supplier Agreement 2026\n\nThe supplier will deliver coffee packaging materials to the Addis Ababa warehouse every Monday. Payment terms are thirty days after an accepted invoice. Quality issues must be reported within five business days. The agreement renews on 15 December 2026.',
    },
    {
      id: 'demo-document-2',
      name: 'Employee Leave Policy.md',
      mimeType: 'text/markdown',
      sizeBytes: 2_340,
      uploadedBy: 'demo-user',
      createdAt: '2026-08-22T12:00:00.000Z',
      status: 'ready',
      extractionError: null,
      storagePath: 'demo/employee-leave-policy.md',
      contentText:
        'Employee Leave Policy\n\nAnnual leave requests should be submitted to the employee manager at least five working days before the requested start date. Emergency leave may be requested on the same day. Managers record approved leave in the company calendar.',
    },
    {
      id: 'demo-document-3',
      name: 'August Sales Report.csv',
      mimeType: 'text/csv',
      sizeBytes: 1_890,
      uploadedBy: 'demo-user',
      createdAt: '2026-08-20T14:20:00.000Z',
      status: 'ready',
      extractionError: null,
      storagePath: 'demo/august-sales-report.csv',
      contentText:
        'region,revenue_etb,orders\nAddis Ababa,850000,42\nOromia,410000,18\nAmhara,295000,13\nTotal,1555000,73',
    },
  ];
}

function demoDocuments() {
  return [...initialDemoDocuments(), ...[...demoFiles.values()].map((item) => item.record)];
}

function toDocumentDTO(document: {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
  status: DocumentStatus;
  extraction_error: string | null;
}): DocumentRecordDTO {
  return {
    id: document.id,
    name: document.name,
    mimeType: document.mime_type,
    sizeBytes: document.size_bytes,
    uploadedBy: document.uploaded_by,
    createdAt: document.created_at,
    status: document.status,
    extractionError: document.extraction_error,
  };
}

function toDocumentDetail(document: {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
  status: DocumentStatus;
  extraction_error: string | null;
  storage_path: string;
  content_text: string;
}): DocumentDetail {
  return {
    ...toDocumentDTO(document),
    storagePath: document.storage_path,
    contentText: document.content_text,
  };
}

function toPublicDocument(document: DocumentDetail): DocumentRecordDTO {
  return {
    id: document.id,
    name: document.name,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedBy: document.uploadedBy,
    createdAt: document.createdAt,
    status: document.status,
    extractionError: document.extractionError,
  };
}

export async function listWorkspaceDocuments(
  workspace: WorkspaceContext,
  limit = 50,
): Promise<DocumentRecordDTO[]> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    return demoDocuments()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit)
      .map(toPublicDocument);
  }

  const { data, error } = await workspace.supabase
    .from('documents')
    .select(documentColumns)
    .eq('organization_id', workspace.organizationId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) throw new Error('Unable to load company documents.');
  return data.map(toDocumentDTO);
}

async function getWorkspaceDocumentDetail(
  workspace: WorkspaceContext,
  documentId: string,
): Promise<DocumentDetail> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const document = demoDocuments().find((item) => item.id === documentId);
    if (!document) throw new Error('Document not found.');
    return document;
  }

  const { data, error } = await workspace.supabase
    .from('documents')
    .select(documentDetailColumns)
    .eq('id', documentId)
    .eq('organization_id', workspace.organizationId)
    .single();

  if (error || !data) throw new Error('Document not found.');
  return toDocumentDetail(data);
}

function safeStorageName(name: string) {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-160);
  return cleaned || 'document';
}

export async function uploadWorkspaceDocument(
  workspace: WorkspaceContext,
  input: UploadDocumentInput,
): Promise<DocumentRecordDTO> {
  let contentText = '';
  let status: DocumentStatus = 'ready';
  let extractionError: string | null = null;

  try {
    contentText = await extractDocumentText(input.bytes, input.mimeType);
    if (!contentText) {
      status = 'failed';
      extractionError =
        'No searchable text was found. The document may contain only scanned images.';
    }
  } catch (error) {
    status = 'failed';
    extractionError =
      error instanceof Error
        ? error.message.slice(0, 500)
        : 'Text extraction failed.';
  }

  const id = randomUUID();
  const storagePath =
    workspace.organizationId +
    '/' +
    workspace.userId +
    '/' +
    id +
    '-' +
    safeStorageName(input.name);

  if (workspace.mode === 'demo' || !workspace.supabase) {
    const record: DocumentDetail = {
      id,
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedBy: workspace.userId,
      createdAt: new Date().toISOString(),
      status,
      extractionError,
      storagePath,
      contentText,
    };
    demoFiles.set(id, { bytes: input.bytes, record });
    return toPublicDocument(record);
  }

  const { error: uploadError } = await workspace.supabase.storage
    .from(storageBucket)
    .upload(storagePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (uploadError) throw new Error('Unable to store the document file.');

  const { data, error: insertError } = await workspace.supabase
    .from('documents')
    .insert({
      id,
      organization_id: workspace.organizationId,
      name: input.name,
      storage_path: storagePath,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      uploaded_by: workspace.userId,
      status,
      content_text: contentText,
      extraction_error: extractionError,
    })
    .select(documentColumns)
    .single();

  if (insertError || !data) {
    await workspace.supabase.storage.from(storageBucket).remove([storagePath]);
    throw new Error('Unable to record the uploaded document.');
  }

  return toDocumentDTO(data);
}

export async function deleteWorkspaceDocument(
  workspace: WorkspaceContext,
  documentId: string,
) {
  const document = await getWorkspaceDocumentDetail(workspace, documentId);
  const canDelete =
    document.uploadedBy === workspace.userId ||
    workspace.role === 'owner' ||
    workspace.role === 'manager';
  if (!canDelete) throw new Error('You do not have permission to delete this document.');

  if (workspace.mode === 'demo' || !workspace.supabase) {
    demoFiles.delete(documentId);
    return document;
  }

  const { error: storageError } = await workspace.supabase.storage
    .from(storageBucket)
    .remove([document.storagePath]);
  if (storageError) throw new Error('Unable to remove the document file.');

  const { data, error } = await workspace.supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', workspace.organizationId)
    .select('id')
    .maybeSingle();
  if (error || !data) throw new Error('Unable to delete the document record.');
  return document;
}

export async function downloadWorkspaceDocument(
  workspace: WorkspaceContext,
  documentId: string,
) {
  const document = await getWorkspaceDocumentDetail(workspace, documentId);
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const stored = demoFiles.get(documentId);
    const bytes =
      stored?.bytes ??
      Buffer.from(document.contentText, 'utf8');
    const blobBytes = new Uint8Array(bytes.length);
    blobBytes.set(bytes);
    return {
      document,
      blob: new Blob([blobBytes], {
        type: document.mimeType || 'application/octet-stream',
      }),
    };
  }

  const { data, error } = await workspace.supabase.storage
    .from(storageBucket)
    .download(document.storagePath);
  if (error || !data) throw new Error('Unable to download the document.');
  return { document, blob: data };
}

export async function searchWorkspaceDocuments(
  workspace: WorkspaceContext,
  query: string,
  limit = 5,
): Promise<DocumentSearchResultDTO[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];

  if (workspace.mode === 'demo' || !workspace.supabase) {
    return demoDocuments()
      .filter((document) => document.status === 'ready')
      .map((document) => {
        const haystack = (document.name + ' ' + document.contentText).toLocaleLowerCase();
        const matches = normalizedQuery
          .split(/\s+/)
          .filter((term) => haystack.includes(term)).length;
        return {
          ...document,
          excerpt: document.contentText.slice(0, 1200),
          rank: matches,
        };
      })
      .filter((document) => document.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, Math.min(Math.max(limit, 1), 20))
      .map((document) => ({
        ...toPublicDocument(document),
        excerpt: document.excerpt,
        rank: document.rank,
      }));
  }

  const { data, error } = await workspace.supabase.rpc(
    'search_company_documents',
    {
      target_organization_id: workspace.organizationId,
      search_query: query.trim(),
      result_limit: Math.min(Math.max(limit, 1), 20),
    },
  );
  if (error) throw new Error('Unable to search company documents.');

  return data.map((document) => ({
    id: document.id,
    name: document.name,
    mimeType: document.mime_type,
    sizeBytes: document.size_bytes,
    uploadedBy: document.uploaded_by,
    createdAt: document.created_at,
    status: document.status,
    extractionError: null,
    excerpt: document.excerpt,
    rank: document.rank,
  }));
}

export async function getWorkspaceDocumentText(
  workspace: WorkspaceContext,
  documentId: string,
  maxCharacters = 20_000,
) {
  const document = await getWorkspaceDocumentDetail(workspace, documentId);
  if (document.status !== 'ready' || !document.contentText) {
    throw new Error('This document does not have searchable text.');
  }
  return {
    document: {
      id: document.id,
      name: document.name,
      mimeType: document.mimeType,
      createdAt: document.createdAt,
    },
    text: document.contentText.slice(0, Math.min(maxCharacters, 50_000)),
    truncated: document.contentText.length > maxCharacters,
  };
}
