import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  createWorkspaceTask,
  listWorkspaceTasks,
  setWorkspaceTaskDone,
} from '@/lib/data/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2_000).nullable().default(null),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueAt: z.string().datetime({ offset: true }).nullable().default(null),
});

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  done: z.boolean(),
});

function errorResponse(message: string, status: number, code: string) {
  return Response.json({ error: { message, code } }, { status });
}

async function requireWorkspace() {
  const result = await getWorkspaceContext();
  if (!result.data || result.error) return result;
  return result;
}

export async function GET() {
  const workspace = await requireWorkspace();
  if (!workspace.data) {
    return errorResponse(
      workspace.error.message,
      workspace.error.status ?? 401,
      workspace.error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  try {
    return Response.json({ tasks: await listWorkspaceTasks(workspace.data) });
  } catch {
    return errorResponse('Unable to load tasks.', 500, 'TASK_LIST_FAILED');
  }
}

export async function POST(request: Request) {
  const workspace = await requireWorkspace();
  if (!workspace.data) {
    return errorResponse(
      workspace.error.message,
      workspace.error.status ?? 401,
      workspace.error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const parsed = createTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('Invalid task request.', 400, 'INVALID_TASK');
  }

  try {
    const task = await createWorkspaceTask(workspace.data, parsed.data);
    return Response.json({ task }, { status: 201 });
  } catch {
    return errorResponse('Unable to create task.', 500, 'TASK_CREATE_FAILED');
  }
}

export async function PATCH(request: Request) {
  const workspace = await requireWorkspace();
  if (!workspace.data) {
    return errorResponse(
      workspace.error.message,
      workspace.error.status ?? 401,
      workspace.error.code ?? 'WORKSPACE_ACCESS_DENIED',
    );
  }

  const parsed = updateTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('Invalid task update.', 400, 'INVALID_TASK_UPDATE');
  }

  try {
    const task = await setWorkspaceTaskDone(
      workspace.data,
      parsed.data.id,
      parsed.data.done,
    );
    return Response.json({ task });
  } catch {
    return errorResponse('Unable to update task.', 500, 'TASK_UPDATE_FAILED');
  }
}
