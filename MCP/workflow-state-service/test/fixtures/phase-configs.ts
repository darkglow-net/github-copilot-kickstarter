import type { PhaseConfig } from '../../src/types.ts';

// 6-phase myidea preset
export const myideaPhaseConfig: PhaseConfig = {
  phases: [
    { key: 'research', label: 'Phase 1: Research & Context', ordinal: 1 },
    { key: 'plan', label: 'Phase 2: Plan & Track', ordinal: 2 },
    { key: 'implement', label: 'Phase 3: Implement', ordinal: 3 },
    { key: 'review', label: 'Phase 4: Code Review', ordinal: 4 },
    { key: 'validate', label: 'Phase 5: Validate', ordinal: 5 },
    { key: 'document', label: 'Phase 6: Document', ordinal: 6 },
  ],
  transitions: [
    { from: 'research', to: 'plan', gateRules: [
      { evidenceCategory: 'checklist', condition: 'should-pass', description: 'Research completeness' },
    ]},
    { from: 'plan', to: 'implement', gateRules: [] },
    { from: 'implement', to: 'review', gateRules: [
      { evidenceCategory: 'test-results', condition: 'must-pass', description: 'All tests pass' },
      { evidenceCategory: 'error-diagnostic', condition: 'must-pass', description: 'Zero compile/lint errors' },
    ]},
    { from: 'review', to: 'validate', gateRules: [
      { evidenceCategory: 'code-review', condition: 'must-pass', description: 'Review approved' },
    ]},
    { from: 'review', to: 'implement', gateRules: [] },
    { from: 'validate', to: 'document', gateRules: [
      { evidenceCategory: 'test-results', condition: 'must-pass', description: 'Final test pass' },
      { evidenceCategory: 'error-diagnostic', condition: 'must-pass', description: 'Zero errors' },
    ]},
    { from: 'document', to: '_close', gateRules: [] },
  ],
};

// 9-phase myspec preset
export const myspecPhaseConfig: PhaseConfig = {
  phases: [
    { key: 'research', label: 'Phase 1: Research', ordinal: 1 },
    { key: 'specification', label: 'Phase 2: Specification', ordinal: 2 },
    { key: 'plan', label: 'Phase 3a: Plan', ordinal: 3 },
    { key: 'tasks', label: 'Phase 3b: Tasks', ordinal: 4 },
    { key: 'analyze', label: 'Phase 3c: Analyze', ordinal: 5 },
    { key: 'implement', label: 'Phase 4: Implement', ordinal: 6 },
    { key: 'review', label: 'Phase 5: Code Review', ordinal: 7 },
    { key: 'validate', label: 'Phase 6: Validate', ordinal: 8 },
    { key: 'document', label: 'Phase 7: Document', ordinal: 9 },
  ],
  transitions: [
    { from: 'research', to: 'specification', gateRules: [
      { evidenceCategory: 'checklist', condition: 'should-pass', description: 'Research completeness' },
    ]},
    { from: 'specification', to: 'plan', gateRules: [
      { evidenceCategory: 'agent-completion', condition: 'must-pass', description: 'Spec agent completed' },
      { evidenceCategory: 'checklist', condition: 'must-pass', description: 'Spec quality checklist' },
    ]},
    { from: 'plan', to: 'tasks', gateRules: [
      { evidenceCategory: 'agent-completion', condition: 'must-pass', description: 'Plan agent completed' },
    ]},
    { from: 'tasks', to: 'analyze', gateRules: [
      { evidenceCategory: 'agent-completion', condition: 'must-pass', description: 'Tasks agent completed' },
    ]},
    { from: 'analyze', to: 'implement', gateRules: [
      { evidenceCategory: 'agent-completion', condition: 'must-pass', description: 'Analysis completed' },
      { evidenceCategory: 'checklist', condition: 'must-pass', description: 'Findings triaged' },
    ]},
    { from: 'implement', to: 'review', gateRules: [
      { evidenceCategory: 'test-results', condition: 'must-pass', description: 'All tests pass' },
      { evidenceCategory: 'error-diagnostic', condition: 'must-pass', description: 'Zero errors' },
      { evidenceCategory: 'checklist', condition: 'must-pass', description: 'All tasks complete, no TODO/FIXME' },
    ]},
    { from: 'review', to: 'validate', gateRules: [
      { evidenceCategory: 'code-review', condition: 'must-pass', description: 'Review approved' },
    ]},
    { from: 'review', to: 'implement', gateRules: [] },
    { from: 'validate', to: 'document', gateRules: [
      { evidenceCategory: 'test-results', condition: 'must-pass', description: 'Final test pass' },
      { evidenceCategory: 'error-diagnostic', condition: 'must-pass', description: 'Zero errors' },
      { evidenceCategory: 'checklist', condition: 'must-pass', description: 'Spec compliance verified' },
    ]},
    { from: 'document', to: '_close', gateRules: [] },
  ],
};

// Minimal valid config for quick tests
export const minimalPhaseConfig: PhaseConfig = {
  phases: [
    { key: 'work', label: 'Work', ordinal: 1 },
  ],
  transitions: [
    { from: 'work', to: '_close', gateRules: [] },
  ],
};
