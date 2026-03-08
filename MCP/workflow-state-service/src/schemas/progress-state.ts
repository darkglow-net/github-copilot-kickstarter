import * as z from 'zod/v4';

export const TaskStatusSchema = z.enum(['not-started', 'in-progress', 'completed']);

export const TaskSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  status: TaskStatusSchema,
});

export const FixTaskSchema = TaskSchema.extend({
  source: z.enum(['gate', 'review', 'analysis', 'manual']),
});

export const PhaseStateSchema = z.object({
  status: z.enum(['not-started', 'in-progress', 'completed', 'blocked']),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  summary: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ProgressStateSchema = z.object({
  feature: z.string().min(1),
  branch: z.string().optional(),
  spec: z.string().optional(),
  complexityScore: z.number().min(0).max(15).optional(),
  startedAt: z.string(),
  phases: z.record(z.string(), PhaseStateSchema),
  tasks: z.array(TaskSchema),
  fixTasks: z.array(FixTaskSchema),
  context: z.record(z.string(), z.unknown()),
  haltReason: z.string().nullable(),
});
