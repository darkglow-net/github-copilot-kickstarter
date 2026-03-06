import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PhaseConfigSchema, PhaseDefinitionSchema, GateRuleSchema, TransitionRuleSchema } from '../../src/schemas/phase-config.ts';
import { myideaPhaseConfig, myspecPhaseConfig, minimalPhaseConfig } from '../fixtures/phase-configs.ts';

describe('PhaseDefinitionSchema', () => {
  it('accepts a valid phase definition', () => {
    const result = PhaseDefinitionSchema.safeParse({ key: 'implement', label: 'Implement', ordinal: 1 });
    assert.equal(result.success, true);
  });

  it('rejects empty key', () => {
    const result = PhaseDefinitionSchema.safeParse({ key: '', label: 'Implement', ordinal: 1 });
    assert.equal(result.success, false);
  });

  it('rejects empty label', () => {
    const result = PhaseDefinitionSchema.safeParse({ key: 'x', label: '', ordinal: 1 });
    assert.equal(result.success, false);
  });

  it('rejects non-integer ordinal', () => {
    const result = PhaseDefinitionSchema.safeParse({ key: 'x', label: 'X', ordinal: 1.5 });
    assert.equal(result.success, false);
  });
});

describe('GateRuleSchema', () => {
  it('accepts a valid gate rule', () => {
    const result = GateRuleSchema.safeParse({
      evidenceCategory: 'test-results',
      condition: 'must-pass',
      description: 'All tests must pass',
    });
    assert.equal(result.success, true);
  });

  it('rejects invalid evidence category', () => {
    const result = GateRuleSchema.safeParse({
      evidenceCategory: 'invalid-category',
      condition: 'must-pass',
      description: 'test',
    });
    assert.equal(result.success, false);
  });

  it('rejects invalid condition', () => {
    const result = GateRuleSchema.safeParse({
      evidenceCategory: 'test-results',
      condition: 'invalid',
      description: 'test',
    });
    assert.equal(result.success, false);
  });
});

describe('TransitionRuleSchema', () => {
  it('accepts a valid transition rule', () => {
    const result = TransitionRuleSchema.safeParse({
      from: 'implement',
      to: 'review',
      gateRules: [],
    });
    assert.equal(result.success, true);
  });

  it('rejects empty from', () => {
    const result = TransitionRuleSchema.safeParse({ from: '', to: 'review', gateRules: [] });
    assert.equal(result.success, false);
  });

  it('rejects empty to', () => {
    const result = TransitionRuleSchema.safeParse({ from: 'implement', to: '', gateRules: [] });
    assert.equal(result.success, false);
  });
});

describe('PhaseConfigSchema', () => {
  it('accepts myidea 6-phase config', () => {
    const result = PhaseConfigSchema.safeParse(myideaPhaseConfig);
    assert.equal(result.success, true);
  });

  it('accepts myspec 9-phase config', () => {
    const result = PhaseConfigSchema.safeParse(myspecPhaseConfig);
    assert.equal(result.success, true);
  });

  it('accepts minimal config', () => {
    const result = PhaseConfigSchema.safeParse(minimalPhaseConfig);
    assert.equal(result.success, true);
  });

  it('rejects duplicate phase keys', () => {
    const config = {
      phases: [
        { key: 'work', label: 'Work 1', ordinal: 1 },
        { key: 'work', label: 'Work 2', ordinal: 2 },
      ],
      transitions: [{ from: 'work', to: '_close', gateRules: [] }],
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });

  it('rejects duplicate ordinals', () => {
    const config = {
      phases: [
        { key: 'alpha', label: 'Alpha', ordinal: 1 },
        { key: 'beta', label: 'Beta', ordinal: 1 },
      ],
      transitions: [{ from: 'alpha', to: '_close', gateRules: [] }],
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });

  it('rejects _close in phases array', () => {
    const config = {
      phases: [
        { key: '_close', label: 'Close', ordinal: 1 },
      ],
      transitions: [{ from: '_close', to: '_close', gateRules: [] }],
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });

  it('rejects transition referencing undefined phase in from', () => {
    const config = {
      phases: [
        { key: 'work', label: 'Work', ordinal: 1 },
      ],
      transitions: [{ from: 'nonexistent', to: '_close', gateRules: [] }],
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });

  it('rejects transition referencing undefined phase in to (non-_close)', () => {
    const config = {
      phases: [
        { key: 'work', label: 'Work', ordinal: 1 },
      ],
      transitions: [{ from: 'work', to: 'nonexistent', gateRules: [] }],
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });

  it('allows _close as transition target', () => {
    const config = {
      phases: [{ key: 'final', label: 'Final', ordinal: 1 }],
      transitions: [{ from: 'final', to: '_close', gateRules: [] }],
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, true);
  });

  it('rejects empty phases array', () => {
    const config = {
      phases: [],
      transitions: [{ from: 'work', to: '_close', gateRules: [] }],
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });

  it('rejects empty transitions array', () => {
    const config = {
      phases: [{ key: 'work', label: 'Work', ordinal: 1 }],
      transitions: [],
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });

  it('accepts config with maxCycles', () => {
    const config = {
      ...minimalPhaseConfig,
      maxCycles: 3,
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, true);
  });

  it('rejects maxCycles of zero', () => {
    const config = {
      ...minimalPhaseConfig,
      maxCycles: 0,
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });

  it('rejects negative maxCycles', () => {
    const config = {
      ...minimalPhaseConfig,
      maxCycles: -1,
    };
    const result = PhaseConfigSchema.safeParse(config);
    assert.equal(result.success, false);
  });
});
