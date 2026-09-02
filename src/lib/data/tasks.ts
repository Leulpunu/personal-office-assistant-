import 'server-only';

import { randomUUID } from 'node:crypto';
import type {
  CreateTaskInput,
  ProposedAgentAction,
} from '@/types/agent';
import type { WorkspaceContext } from '@/lib/auth/workspace';
import type { Json } from '@/types/database';
import type { TaskRecordDTO } from '@/types/tasks';

export type TaskDTO = TaskRecordDTO;

const demoTasks: TaskDTO[] = [
  {
    id: 'demo-task-1',
    title: 'Review Q3 supplier agreements',
    description: null,
    status: 'todo',
    priority: 'high',
    dueAt: null,
  },
  {
    id: 'demo-task-2',
    title: 'Approve August payroll',
    description: null,
    status: 'todo',
    priority: 'high',
    dueAt: null,
  },
  {
    id: 'demo-task-3',
    title: 'Prepare client presentation',
    description: null,
    status: 'in_progress',
    priority: 'medium',
    dueAt: null,
  },
];

export async function listOpenTasks(
  workspace: WorkspaceContext,
  limit = 10,
): Promise<TaskDTO[]> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    return demoTasks.slice(0, limit);
  }

  const { data, error } = await workspace.supabase
    .from('tasks')
    .select('id, title, description, status, priority, due_at')
    .eq('organization_id', workspace.organizationId)
    .in('status', ['todo', 'in_progress'])
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error('Unable to list company tasks.');

  return data.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueAt: task.due_at,
  }));
}

export async function listWorkspaceTasks(
  workspace: WorkspaceContext,
  limit = 100,
): Promise<TaskDTO[]> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    return demoTasks.slice(0, limit);
  }

  const { data, error } = await workspace.supabase
    .from('tasks')
    .select('id, title, description, status, priority, due_at')
    .eq('organization_id', workspace.organizationId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error('Unable to load company tasks.');

  return data.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueAt: task.due_at,
  }));
}

export async function createWorkspaceTask(
  workspace: WorkspaceContext,
  input: CreateTaskInput,
): Promise<TaskDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    return {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: 'todo',
      priority: input.priority,
      dueAt: input.dueAt,
    };
  }

  const { data, error } = await workspace.supabase
    .from('tasks')
    .insert({
      organization_id: workspace.organizationId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      due_at: input.dueAt,
      created_by: workspace.userId,
      assignee_id: workspace.userId,
    })
    .select('id, title, description, status, priority, due_at')
    .single();

  if (error || !data) throw new Error('Unable to create the company task.');

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    dueAt: data.due_at,
  };
}

export async function setWorkspaceTaskDone(
  workspace: WorkspaceContext,
  taskId: string,
  done: boolean,
): Promise<TaskDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    const task = demoTasks.find((item) => item.id === taskId);
    if (!task) throw new Error('Task not found.');
    return { ...task, status: done ? 'done' : 'todo' };
  }

  const { data, error } = await workspace.supabase
    .from('tasks')
    .update({
      status: done ? 'done' : 'todo',
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
    .eq('organization_id', workspace.organizationId)
    .select('id, title, description, status, priority, due_at')
    .single();

  if (error || !data) throw new Error('Unable to update the company task.');

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    dueAt: data.due_at,
  };
}

export async function proposeCreateTask(
  workspace: WorkspaceContext,
  input: CreateTaskInput,
): Promise<ProposedAgentAction> {
  const id = randomUUID();

  if (workspace.mode === 'supabase' && workspace.supabase) {
    const { data, error } = await workspace.supabase
      .from('agent_action_log')
      .insert({
        id,
        organization_id: workspace.organizationId,
        user_id: workspace.userId,
        tool_name: 'create_task',
        status: 'proposed',
        input: input as unknown as Json,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error('Unable to record the proposed task.');
    }
  }

  return {
    id,
    type: 'create_task',
    label: 'Create task: ' + input.title,
    input,
  };
}

export async function approveAndCreateTask(
  workspace: WorkspaceContext,
  proposal: Extract<ProposedAgentAction, { type: 'create_task' }>,
): Promise<TaskDTO> {
  if (workspace.mode === 'demo' || !workspace.supabase) {
    return {
      id: randomUUID(),
      title: proposal.input.title,
      description: proposal.input.description,
      status: 'todo',
      priority: proposal.input.priority,
      dueAt: proposal.input.dueAt,
    };
  }

  const { data: action, error: actionError } = await workspace.supabase
    .from('agent_action_log')
    .select('id, status, tool_name, input')
    .eq('id', proposal.id)
    .eq('organization_id', workspace.organizationId)
    .eq('user_id', workspace.userId)
    .single();

  if (
    actionError ||
    !action ||
    action.status !== 'proposed' ||
    action.tool_name !== 'create_task'
  ) {
    throw new Error('This agent action is missing, expired, or already used.');
  }

  const storedInput = action.input as unknown as CreateTaskInput;
  if (storedInput.title !== proposal.input.title) {
    throw new Error('The approved action does not match the proposed action.');
  }

  const { data: approvedAction, error: approvalError } = await workspace.supabase
    .from('agent_action_log')
    .update({ status: 'approved' })
    .eq('id', action.id)
    .eq('status', 'proposed')
    .select('id')
    .maybeSingle();

  if (approvalError || !approvedAction) {
    throw new Error('This agent action was already approved or is no longer available.');
  }

  const { data: task, error: taskError } = await workspace.supabase
    .from('tasks')
    .insert({
      organization_id: workspace.organizationId,
      title: storedInput.title,
      description: storedInput.description,
      priority: storedInput.priority,
      due_at: storedInput.dueAt,
      created_by: workspace.userId,
      assignee_id: workspace.userId,
    })
    .select('id, title, description, status, priority, due_at')
    .single();

  if (taskError || !task) {
    await workspace.supabase
      .from('agent_action_log')
      .update({
        status: 'failed',
        result: { error: 'Task creation failed.' },
        executed_at: new Date().toISOString(),
      })
      .eq('id', action.id);
    throw new Error('Unable to create the task.');
  }

  await workspace.supabase
    .from('agent_action_log')
    .update({
      status: 'executed',
      result: { task_id: task.id },
      executed_at: new Date().toISOString(),
    })
    .eq('id', action.id);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueAt: task.due_at,
  };
}
