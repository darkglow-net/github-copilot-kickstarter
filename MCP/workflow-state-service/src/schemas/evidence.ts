import * as z from 'zod/v4';

export const TestResultsSchema = z.object({
  framework: z.string().optional(),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  skipped: z.number().int().min(0).optional(),
  total: z.number().int().min(0),
  duration: z.number().min(0).optional(),
  coveragePercent: z.number().min(0).max(100).optional(),
});

export const ErrorDiagnosticSchema = z.object({
  source: z.string().min(1),
  errors: z.number().int().min(0),
  warnings: z.number().int().min(0),
  filesChecked: z.number().int().min(0).optional(),
});

export const ChecklistItemSchema = z.object({
  label: z.string(),
  status: z.enum(['passed', 'failed', 'skipped']),
  note: z.string().optional(),
});

export const ChecklistSchema = z.object({
  checklistName: z.string().min(1),
  totalItems: z.number().int().min(0),
  completedItems: z.number().int().min(0),
  failedItems: z.number().int().min(0),
  items: z.array(ChecklistItemSchema).optional(),
});

export const AgentCompletionSchema = z.object({
  agentName: z.string().min(1),
  runId: z.string().optional(),
  taskDescription: z.string().min(1),
  status: z.enum(['completed', 'failed', 'partial']),
  summary: z.string().min(1),
  artifacts: z.array(z.object({
    path: z.string(),
    action: z.enum(['created', 'modified']),
  })).optional(),
});

export const CodeReviewFindingSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.string().optional(),
  file: z.string().optional(),
  line: z.number().int().optional(),
  description: z.string(),
  suggestion: z.string().optional(),
});

export const CodeReviewSchema = z.object({
  reviewer: z.string().min(1),
  reviewerType: z.enum(['human', 'agent', 'automated']),
  verdict: z.enum(['approved', 'changes-requested', 'commented']),
  findingCount: z.number().int().min(0),
  criticalFindings: z.number().int().min(0),
  findings: z.array(CodeReviewFindingSchema).optional(),
});

export const CustomEvidenceSchema = z.object({
  label: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  passed: z.boolean(),
});

export const EvidenceCategorySchema = z.enum([
  'test-results',
  'error-diagnostic',
  'checklist',
  'agent-completion',
  'code-review',
  'custom',
]);

export const evidenceSchemaByCategory = {
  'test-results': TestResultsSchema,
  'error-diagnostic': ErrorDiagnosticSchema,
  'checklist': ChecklistSchema,
  'agent-completion': AgentCompletionSchema,
  'code-review': CodeReviewSchema,
  'custom': CustomEvidenceSchema,
} as const;

export type GateResult = 'pass' | 'fail' | 'warn' | 'pending';

export function computeGateResult(category: string, data: Record<string, unknown>): GateResult {
  switch (category) {
    case 'test-results':
      return (data.failed as number) === 0 ? 'pass' : 'fail';
    case 'error-diagnostic':
      return (data.errors as number) === 0 ? 'pass' : 'fail';
    case 'checklist':
      return (data.failedItems as number) === 0 &&
        (data.completedItems as number) === (data.totalItems as number)
        ? 'pass'
        : 'fail';
    case 'agent-completion':
      return (data.status as string) === 'completed' ? 'pass' : 'fail';
    case 'code-review':
      return (data.verdict as string) === 'approved' &&
        (data.criticalFindings as number) === 0
        ? 'pass'
        : 'fail';
    case 'custom':
      return (data.passed as boolean) ? 'pass' : 'fail';
    default:
      return 'pending';
  }
}
