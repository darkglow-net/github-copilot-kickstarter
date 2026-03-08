import * as z from 'zod/v4';

export const PhaseDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  ordinal: z.number().int(),
});

export const GateRuleSchema = z.object({
  evidenceCategory: z.enum([
    'test-results',
    'error-diagnostic',
    'checklist',
    'agent-completion',
    'code-review',
    'custom',
  ]),
  condition: z.enum(['must-pass', 'should-pass', 'informational']),
  description: z.string().min(1),
});

export const TransitionRuleSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  gateRules: z.array(GateRuleSchema),
});

const PhaseConfigBaseSchema = z.object({
  phases: z.array(PhaseDefinitionSchema).min(1),
  transitions: z.array(TransitionRuleSchema).min(1),
  maxCycles: z.number().int().positive().optional(),
});

export const PhaseConfigSchema = PhaseConfigBaseSchema.check(
  z.refine((config) => {
    const keys = config.phases.map((p) => p.key);
    return new Set(keys).size === keys.length;
  }, 'Phase keys must be unique'),
  z.refine((config) => {
    const ordinals = config.phases.map((p) => p.ordinal);
    return new Set(ordinals).size === ordinals.length;
  }, 'Phase ordinals must be unique'),
  z.refine((config) => {
    const keys = new Set(config.phases.map((p) => p.key));
    return !keys.has('_close');
  }, '_close must not appear in phases array'),
  z.refine((config) => {
    const keys = new Set(config.phases.map((p) => p.key));
    return config.transitions.every(
      (t) => keys.has(t.from) && (keys.has(t.to) || t.to === '_close'),
    );
  }, 'Transition references must point to defined phase keys (or _close for "to")'),
);

export type PhaseConfigInput = z.input<typeof PhaseConfigSchema>;
export type PhaseConfigOutput = z.output<typeof PhaseConfigSchema>;
