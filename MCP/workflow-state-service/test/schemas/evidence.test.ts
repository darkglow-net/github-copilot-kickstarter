import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TestResultsSchema,
  ErrorDiagnosticSchema,
  ChecklistSchema,
  AgentCompletionSchema,
  CodeReviewSchema,
  CustomEvidenceSchema,
  EvidenceCategorySchema,
  evidenceSchemaByCategory,
  computeGateResult,
} from '../../src/schemas/evidence.ts';

describe('TestResultsSchema', () => {
  it('accepts valid test results', () => {
    const result = TestResultsSchema.safeParse({ passed: 10, failed: 0, total: 10 });
    assert.equal(result.success, true);
  });

  it('accepts test results with optional fields', () => {
    const result = TestResultsSchema.safeParse({
      framework: 'node:test',
      passed: 8,
      failed: 2,
      skipped: 1,
      total: 11,
      duration: 1234.5,
      coveragePercent: 85.5,
    });
    assert.equal(result.success, true);
  });

  it('rejects negative failed count', () => {
    const result = TestResultsSchema.safeParse({ passed: 10, failed: -1, total: 10 });
    assert.equal(result.success, false);
  });

  it('rejects non-integer passed count', () => {
    const result = TestResultsSchema.safeParse({ passed: 1.5, failed: 0, total: 2 });
    assert.equal(result.success, false);
  });

  it('rejects coverage over 100', () => {
    const result = TestResultsSchema.safeParse({ passed: 1, failed: 0, total: 1, coveragePercent: 101 });
    assert.equal(result.success, false);
  });
});

describe('ErrorDiagnosticSchema', () => {
  it('accepts valid error diagnostic', () => {
    const result = ErrorDiagnosticSchema.safeParse({ source: 'tsc', errors: 0, warnings: 3 });
    assert.equal(result.success, true);
  });

  it('rejects empty source', () => {
    const result = ErrorDiagnosticSchema.safeParse({ source: '', errors: 0, warnings: 0 });
    assert.equal(result.success, false);
  });
});

describe('ChecklistSchema', () => {
  it('accepts valid checklist', () => {
    const result = ChecklistSchema.safeParse({
      checklistName: 'pre-review',
      totalItems: 5,
      completedItems: 5,
      failedItems: 0,
    });
    assert.equal(result.success, true);
  });

  it('accepts checklist with items array', () => {
    const result = ChecklistSchema.safeParse({
      checklistName: 'tasks',
      totalItems: 2,
      completedItems: 1,
      failedItems: 1,
      items: [
        { label: 'Task A', status: 'passed' },
        { label: 'Task B', status: 'failed', note: 'Needs rework' },
      ],
    });
    assert.equal(result.success, true);
  });

  it('rejects invalid item status', () => {
    const result = ChecklistSchema.safeParse({
      checklistName: 'x',
      totalItems: 1,
      completedItems: 0,
      failedItems: 0,
      items: [{ label: 'A', status: 'unknown' }],
    });
    assert.equal(result.success, false);
  });
});

describe('AgentCompletionSchema', () => {
  it('accepts valid agent completion', () => {
    const result = AgentCompletionSchema.safeParse({
      agentName: 'tdd-red',
      taskDescription: 'Write tests',
      status: 'completed',
      summary: 'All tests written',
    });
    assert.equal(result.success, true);
  });

  it('accepts with optional artifacts', () => {
    const result = AgentCompletionSchema.safeParse({
      agentName: 'implement',
      taskDescription: 'Build feature',
      status: 'completed',
      summary: 'Done',
      artifacts: [{ path: 'src/main.ts', action: 'created' }],
    });
    assert.equal(result.success, true);
  });

  it('rejects invalid status', () => {
    const result = AgentCompletionSchema.safeParse({
      agentName: 'test',
      taskDescription: 't',
      status: 'unknown',
      summary: 's',
    });
    assert.equal(result.success, false);
  });
});

describe('CodeReviewSchema', () => {
  it('accepts valid code review', () => {
    const result = CodeReviewSchema.safeParse({
      reviewer: 'copilot',
      reviewerType: 'agent',
      verdict: 'approved',
      findingCount: 0,
      criticalFindings: 0,
    });
    assert.equal(result.success, true);
  });

  it('accepts with findings array', () => {
    const result = CodeReviewSchema.safeParse({
      reviewer: 'human-dev',
      reviewerType: 'human',
      verdict: 'changes-requested',
      findingCount: 1,
      criticalFindings: 1,
      findings: [{
        severity: 'critical',
        description: 'SQL injection vulnerability',
        file: 'src/db.ts',
        line: 42,
        suggestion: 'Use parameterized queries',
      }],
    });
    assert.equal(result.success, true);
  });

  it('rejects invalid verdict', () => {
    const result = CodeReviewSchema.safeParse({
      reviewer: 'x',
      reviewerType: 'agent',
      verdict: 'rejected',
      findingCount: 0,
      criticalFindings: 0,
    });
    assert.equal(result.success, false);
  });
});

describe('CustomEvidenceSchema', () => {
  it('accepts valid custom evidence', () => {
    const result = CustomEvidenceSchema.safeParse({
      label: 'Manual check',
      payload: { detail: 'verified' },
      passed: true,
    });
    assert.equal(result.success, true);
  });

  it('rejects empty label', () => {
    const result = CustomEvidenceSchema.safeParse({
      label: '',
      payload: {},
      passed: true,
    });
    assert.equal(result.success, false);
  });
});

describe('EvidenceCategorySchema', () => {
  it('accepts all valid categories', () => {
    const categories = ['test-results', 'error-diagnostic', 'checklist', 'agent-completion', 'code-review', 'custom'];
    for (const cat of categories) {
      const result = EvidenceCategorySchema.safeParse(cat);
      assert.equal(result.success, true, `Expected ${cat} to be valid`);
    }
  });

  it('rejects invalid category', () => {
    const result = EvidenceCategorySchema.safeParse('invalid');
    assert.equal(result.success, false);
  });
});

describe('evidenceSchemaByCategory', () => {
  it('has entries for all 6 categories', () => {
    const expected = ['test-results', 'error-diagnostic', 'checklist', 'agent-completion', 'code-review', 'custom'];
    for (const cat of expected) {
      assert.ok(evidenceSchemaByCategory[cat as keyof typeof evidenceSchemaByCategory], `Missing schema for ${cat}`);
    }
  });
});

describe('computeGateResult', () => {
  describe('test-results', () => {
    it('returns pass when failed is 0', () => {
      assert.equal(computeGateResult('test-results', { passed: 10, failed: 0, total: 10 }), 'pass');
    });

    it('returns fail when failed > 0', () => {
      assert.equal(computeGateResult('test-results', { passed: 8, failed: 2, total: 10 }), 'fail');
    });
  });

  describe('error-diagnostic', () => {
    it('returns pass when errors is 0', () => {
      assert.equal(computeGateResult('error-diagnostic', { source: 'tsc', errors: 0, warnings: 5 }), 'pass');
    });

    it('returns fail when errors > 0', () => {
      assert.equal(computeGateResult('error-diagnostic', { source: 'tsc', errors: 3, warnings: 0 }), 'fail');
    });
  });

  describe('checklist', () => {
    it('returns pass when all completed and none failed', () => {
      assert.equal(computeGateResult('checklist', { totalItems: 5, completedItems: 5, failedItems: 0 }), 'pass');
    });

    it('returns fail when items are failed', () => {
      assert.equal(computeGateResult('checklist', { totalItems: 5, completedItems: 4, failedItems: 1 }), 'fail');
    });

    it('returns fail when not all items completed', () => {
      assert.equal(computeGateResult('checklist', { totalItems: 5, completedItems: 3, failedItems: 0 }), 'fail');
    });
  });

  describe('agent-completion', () => {
    it('returns pass when status is completed', () => {
      assert.equal(computeGateResult('agent-completion', { status: 'completed' }), 'pass');
    });

    it('returns fail when status is failed', () => {
      assert.equal(computeGateResult('agent-completion', { status: 'failed' }), 'fail');
    });

    it('returns fail when status is partial', () => {
      assert.equal(computeGateResult('agent-completion', { status: 'partial' }), 'fail');
    });
  });

  describe('code-review', () => {
    it('returns pass when approved with no critical findings', () => {
      assert.equal(computeGateResult('code-review', { verdict: 'approved', criticalFindings: 0 }), 'pass');
    });

    it('returns fail when changes requested', () => {
      assert.equal(computeGateResult('code-review', { verdict: 'changes-requested', criticalFindings: 0 }), 'fail');
    });

    it('returns fail when approved but has critical findings', () => {
      assert.equal(computeGateResult('code-review', { verdict: 'approved', criticalFindings: 1 }), 'fail');
    });
  });

  describe('custom', () => {
    it('returns pass when passed is true', () => {
      assert.equal(computeGateResult('custom', { passed: true }), 'pass');
    });

    it('returns fail when passed is false', () => {
      assert.equal(computeGateResult('custom', { passed: false }), 'fail');
    });
  });

  describe('unknown category', () => {
    it('returns pending for unknown category', () => {
      assert.equal(computeGateResult('unknown-thing', {}), 'pending');
    });
  });
});
