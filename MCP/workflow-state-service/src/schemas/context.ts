import * as z from 'zod/v4';

export const ContextCategorySchema = z.enum(['briefing', 'delegation', 'decision']);

export const ContextEntrySchema = z.object({
  category: ContextCategorySchema,
  key: z.string().min(1),
  value: z.string(),
  authoredBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
