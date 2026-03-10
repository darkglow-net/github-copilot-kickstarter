# Evidence Categories & Typed Workflow Elements — Research Spike

**Status:** Completed  
**Date:** 2026-03-05  
**Purpose:** Compile evidence types, gate checks, and typed workflow element patterns from CI/CD, quality gates, workflow engines, and AI agent orchestration systems. Output informed the evidence schema design for the MCP Workflow State Service.

> **✅ Implemented** — The evidence category schema is shipped in [`workflow-state-service-mcp`](../../../../workflow-state-service-mcp) at `src/schemas/evidence.ts`.

---

## 1) Evidence Types for Phase Transitions

These are the categories of "proof" a coordinator should require before allowing a workflow phase transition. Each entry includes the name, typical fields, where it's used, and its result shape.

---

### 1.1 Test Results

| Field | Type | Description |
|-------|------|-------------|
| `framework` | `string` | e.g., "vitest", "pester", "pytest", "jest" |
| `passed` | `int32` | Number of passing tests |
| `failed` | `int32` | Number of failing tests |
| `skipped` | `int32` | Number of skipped tests |
| `total` | `int32` | Total test count |
| `duration` | `float64` | Execution time in seconds |
| `coveragePercent` | `float64?` | Optional line/branch coverage |
| `suiteResults` | `SuiteResult[]?` | Optional per-suite breakdown |
| `reportPath` | `string?` | Path to JUnit XML or similar artifact |

**Result shape:** Structured (numeric + pass/fail derivable from `failed === 0`)  
**Used at gates:** Implement → Review, Review → Validate, any CI merge gate  
**Sources:** GitHub Actions test reporters, Azure DevOps test tasks, Jenkins JUnit plugin, SonarQube test execution import

---

### 1.2 Code Coverage

| Field | Type | Description |
|-------|------|-------------|
| `lineCoverage` | `float64` | Percentage of lines covered |
| `branchCoverage` | `float64?` | Percentage of branches covered |
| `functionCoverage` | `float64?` | Percentage of functions covered |
| `statementCoverage` | `float64?` | Percentage of statements covered |
| `delta` | `float64?` | Coverage change vs. baseline |
| `threshold` | `float64` | Required minimum (e.g., 80.0) |
| `met` | `boolean` | Whether threshold was met |

**Result shape:** Numeric with boolean gate  
**Used at gates:** Implement → Review, CI quality gate  
**Sources:** Istanbul/nyc, coverage.py, dotCover, SonarQube coverage conditions

---

### 1.3 Static Analysis / Lint Results

| Field | Type | Description |
|-------|------|-------------|
| `tool` | `string` | e.g., "eslint", "psscriptanalyzer", "pylint", "sonarqube" |
| `errors` | `int32` | Error-level violations |
| `warnings` | `int32` | Warning-level violations |
| `infos` | `int32` | Informational findings |
| `fixable` | `int32?` | Auto-fixable count |
| `newIssues` | `int32?` | Issues introduced in this change (SonarQube "new code" concept) |
| `blockers` | `int32?` | Blocker-severity issues (SonarQube) |
| `criticals` | `int32?` | Critical-severity issues (SonarQube) |

**Result shape:** Numeric with pass/fail derivable from `errors === 0` (or `blockers === 0 && criticals === 0`)  
**Used at gates:** Pre-commit, Implement → Review, CI quality gate  
**Sources:** ESLint, PSScriptAnalyzer, Pylint, SonarQube quality gate conditions, CodeQL

---

### 1.4 Build Result

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"success" \| "failure" \| "cancelled"` | Build outcome |
| `duration` | `float64` | Build time in seconds |
| `artifactPaths` | `string[]?` | Paths to produced artifacts |
| `errors` | `BuildError[]?` | Structured error list |
| `warnings` | `int32?` | Compiler warning count |

**Result shape:** Boolean pass/fail with optional structured details  
**Used at gates:** Any CI pipeline gate, pre-deploy  
**Sources:** GitHub Actions job conclusion, Azure DevOps build result, Jenkins build status

---

### 1.5 Security Scan

| Field | Type | Description |
|-------|------|-------------|
| `scanner` | `string` | e.g., "dependabot", "snyk", "trivy", "codeql", "gitleaks" |
| `scanType` | `"sast" \| "dast" \| "sca" \| "secrets" \| "container"` | Category of scan |
| `critical` | `int32` | Critical vulnerabilities found |
| `high` | `int32` | High-severity vulnerabilities |
| `medium` | `int32` | Medium-severity vulnerabilities |
| `low` | `int32` | Low-severity vulnerabilities |
| `total` | `int32` | Total vulnerabilities |
| `fixable` | `int32?` | Vulnerabilities with available fixes |
| `newFindings` | `int32?` | Net-new vs. baseline |

**Result shape:** Numeric with pass/fail derivable from policy (e.g., `critical === 0 && high === 0`)  
**Used at gates:** CI merge gate, pre-deploy, release gate  
**Sources:** GitHub Advanced Security, Dependabot, Snyk, Trivy, OWASP ZAP, SonarQube security hotspots

---

### 1.6 Checklist Completion

| Field | Type | Description |
|-------|------|-------------|
| `checklistId` | `string` | Identifier for the checklist template |
| `checklistName` | `string` | Human-readable name |
| `totalItems` | `int32` | Total items in checklist |
| `completedItems` | `int32` | Items marked complete |
| `failedItems` | `int32` | Items explicitly failed |
| `items` | `ChecklistItem[]?` | Per-item detail |

Where `ChecklistItem`:
| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | What's being verified |
| `status` | `"passed" \| "failed" \| "skipped" \| "not-checked"` | Item result |
| `note` | `string?` | Reviewer comment |

**Result shape:** Structured with boolean gate (`failedItems === 0 && completedItems === totalItems`)  
**Used at gates:** Specification quality, pre-review gate, constitution compliance, AI workflow phase transitions  
**Sources:** PR templates, code review checklists, your speckit.checklist agent, SonarQube quality gate

---

### 1.7 Code Review / Peer Review

| Field | Type | Description |
|-------|------|-------------|
| `reviewer` | `string` | Who performed the review (human or agent name) |
| `reviewerType` | `"human" \| "agent" \| "automated"` | Actor kind |
| `verdict` | `"approved" \| "changes-requested" \| "commented"` | Review outcome |
| `findingCount` | `int32` | Total findings |
| `criticalFindings` | `int32` | Blocking findings |
| `findings` | `ReviewFinding[]?` | Detailed finding list |

Where `ReviewFinding`:
| Field | Type | Description |
|-------|------|-------------|
| `severity` | `"critical" \| "high" \| "medium" \| "low" \| "info"` | Finding severity |
| `category` | `string` | e.g., "correctness", "security", "performance", "style" |
| `file` | `string?` | Affected file |
| `line` | `int32?` | Line number |
| `description` | `string` | What was found |
| `suggestion` | `string?` | Recommended fix |

**Result shape:** Structured with boolean gate (`verdict === "approved"` or `criticalFindings === 0`)  
**Used at gates:** Review → Validate, PR merge gate  
**Sources:** GitHub PR reviews, your code-review agent, Azure DevOps required reviewers, Copilot code review

---

### 1.8 Deployment Verification

| Field | Type | Description |
|-------|------|-------------|
| `environment` | `string` | Target environment name |
| `status` | `"success" \| "failure" \| "rollback"` | Deployment outcome |
| `version` | `string` | Deployed version/tag/SHA |
| `healthCheckPassed` | `boolean` | Post-deployment health |
| `smokeTestsPassed` | `boolean?` | Smoke test suite result |
| `duration` | `float64?` | Deployment time in seconds |
| `url` | `string?` | Deployed URL |

**Result shape:** Boolean pass/fail with structured metadata  
**Used at gates:** Deploy → Production, canary promotion  
**Sources:** GitHub Environments, Azure DevOps release gates, Kubernetes readiness probes, ArgoCD sync status

---

### 1.9 Performance Benchmark

| Field | Type | Description |
|-------|------|-------------|
| `benchmark` | `string` | Benchmark name/suite |
| `metric` | `string` | What's measured (e.g., "p95_latency_ms", "throughput_rps") |
| `value` | `float64` | Measured value |
| `baseline` | `float64?` | Previous/reference value |
| `threshold` | `float64?` | Acceptable limit |
| `regression` | `boolean` | Whether value regressed beyond threshold |
| `unit` | `string` | Measurement unit |

**Result shape:** Numeric with boolean regression flag  
**Used at gates:** Pre-release, performance regression CI gate  
**Sources:** Lighthouse CI, k6, Artillery, custom benchmark harnesses

---

### 1.10 Approval / Sign-Off

| Field | Type | Description |
|-------|------|-------------|
| `approver` | `string` | Who approved |
| `approverRole` | `string?` | e.g., "tech-lead", "product-owner", "security-reviewer" |
| `decision` | `"approved" \| "rejected" \| "deferred"` | Decision outcome |
| `reason` | `string?` | Justification or conditions |
| `timestamp` | `string` | ISO-8601 when approval was given |
| `expiresAt` | `string?` | ISO-8601 if approval has a TTL |

**Result shape:** Boolean (approved/rejected) with metadata  
**Used at gates:** Environment promotion, release gate, compliance gate  
**Sources:** GitHub environment protection rules, Azure DevOps approval gates, ITSM change approvals

---

### 1.11 AI Agent Completion Receipt

| Field | Type | Description |
|-------|------|-------------|
| `agentName` | `string` | Agent identity (e.g., "speckit.analyze") |
| `runId` | `string` | Unique invocation ID |
| `taskDescription` | `string` | What the agent was asked to do |
| `status` | `"completed" \| "failed" \| "partial"` | Completion state |
| `summary` | `string` | Agent's summary of what it did |
| `artifacts` | `ArtifactRef[]?` | Files created/modified |
| `outputData` | `object?` | Structured output (findings, plan, etc.) |
| `tokenUsage` | `int32?` | Tokens consumed (cost tracking) |
| `duration` | `float64?` | Execution time in seconds |

**Result shape:** Structured with boolean derivable from `status === "completed"`  
**Used at gates:** Any AI workflow phase transition (your coordinator pattern)  
**Sources:** LangGraph node outputs, CrewAI task results, AutoGen agent messages, your `report_subagent_done()` tool

---

### 1.12 Artifact Existence / Validation

| Field | Type | Description |
|-------|------|-------------|
| `artifactType` | `string` | e.g., "spec-document", "api-schema", "migration-file", "docker-image" |
| `path` | `string` | File path or artifact URI |
| `exists` | `boolean` | Whether the artifact was found |
| `validationResult` | `"valid" \| "invalid" \| "not-validated"` | Schema/format validation |
| `hash` | `string?` | Content hash for integrity |
| `sizeBytes` | `int64?` | Artifact size |

**Result shape:** Boolean (exists && valid)  
**Used at gates:** Specification → Plan (spec doc exists), Plan → Tasks (plan doc exists), Build → Deploy (artifact produced)  
**Sources:** GitHub Actions artifact upload, Azure DevOps publish artifact, container registry

---

### 1.13 Compliance / Policy Check

| Field | Type | Description |
|-------|------|-------------|
| `policy` | `string` | Policy name or ID |
| `framework` | `string?` | e.g., "SOC2", "HIPAA", "internal", "constitution" |
| `status` | `"compliant" \| "non-compliant" \| "waived"` | Compliance result |
| `violations` | `int32` | Number of violations |
| `details` | `PolicyViolation[]?` | Per-violation detail |

**Result shape:** Boolean with optional structured violations  
**Used at gates:** Release gate, deployment gate, your constitution compliance check  
**Sources:** OPA/Rego policies, Azure Policy, Kubernetes admission controllers, your speckit.constitution agent

---

### 1.14 Error / Diagnostic Count

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | e.g., "typescript-compiler", "vscode-diagnostics", "runtime-errors" |
| `errors` | `int32` | Error count |
| `warnings` | `int32` | Warning count |
| `filesChecked` | `int32?` | Scope of check |
| `clean` | `boolean` | Whether error count is zero |

**Result shape:** Numeric with boolean derivable from `errors === 0`  
**Used at gates:** Implement → Review ("errors clean" gate in your current workflow)  
**Sources:** `tsc --noEmit`, VS Code diagnostic API, `dotnet build`, `go vet`

---

## 2) Evidence Category Enum (Recommended)

For the MCP tool surface, a discriminated union keyed by `category`:

```
EvidenceCategory:
  "test-results"
  "code-coverage"
  "static-analysis"
  "build-result"
  "security-scan"
  "checklist"
  "code-review"
  "deployment"
  "performance"
  "approval"
  "agent-completion"
  "artifact-validation"
  "compliance"
  "error-diagnostic"
  "custom"
```

The `custom` category allows freeform `payload: object` for unanticipated evidence types without schema changes.

---

## 3) Other Workflow Elements That Benefit from Typed Categories

### 3.1 Event Types (Event-Driven Architectures)

Event-driven systems consistently use typed event envelopes. From CloudEvents spec, Temporal, and your existing `workflow_events` table:

| Event Type | Description | Typical Payload |
|------------|-------------|-----------------|
| `phase-started` | A workflow phase has begun | `{ phaseKey, startedAt }` |
| `phase-completed` | A workflow phase finished | `{ phaseKey, completedAt, summary }` |
| `phase-blocked` | A phase is blocked | `{ phaseKey, reason, blockedBy? }` |
| `evidence-submitted` | Evidence attached to a transition | `{ evidenceCategory, evidenceData }` |
| `transition-requested` | Coordinator requests phase change | `{ from, to, evidence[] }` |
| `transition-approved` | Transition passed validation | `{ from, to }` |
| `transition-rejected` | Transition failed validation | `{ from, to, reason }` |
| `subagent-dispatched` | Subagent work started | `{ agentName, runId, taskDescription }` |
| `subagent-completed` | Subagent reported completion | `{ agentName, runId, summary, artifacts }` |
| `subagent-failed` | Subagent reported failure | `{ agentName, runId, error }` |
| `finding-created` | A review/analysis finding was recorded | `{ findingId, severity, description }` |
| `fix-task-created` | A fix task was generated from a finding | `{ taskId, title, source }` |
| `fix-task-completed` | A fix task was resolved | `{ taskId, resolution }` |
| `workflow-created` | New workflow initialized | `{ feature, branch, spec }` |
| `workflow-halted` | Workflow hit a cap or fatal error | `{ reason }` |
| `workflow-exported` | Final state exported to files | `{ exportPaths }` |
| `workflow-closed` | Workflow marked as done | `{}` |
| `error-logged` | An error or warning was recorded | `{ message, severity, context? }` |
| `note-added` | A freeform observation or decision note | `{ text, author? }` |

**Pattern:** Each event should have a common envelope (`eventId`, `workflowId`, `seq`, `timestamp`, `actorKind`, `actorName`, `phaseKey?`, `eventType`) plus a typed `payload` discriminated by `eventType`.

---

### 3.2 Decision / Approval Types

Workflows frequently need typed decision records:

| Decision Type | Fields | Used For |
|---------------|--------|----------|
| `gate-pass` | `{ gateId, evidence[], result: pass/fail }` | Automated quality gate evaluation |
| `manual-approval` | `{ approver, role, decision, reason?, conditions? }` | Human sign-off for promotion |
| `exception-waiver` | `{ policy, waiver, justification, expiry? }` | Bypassing a policy with documented reason |
| `architecture-decision` | `{ title, context, decision, consequences }` | ADR-style records within workflow |
| `scope-change` | `{ original, revised, justification, approver }` | Mid-workflow scope modifications |
| `retry-decision` | `{ attempt, maxAttempts, reason, action: "retry"/"halt"/"skip" }` | Whether to retry a failed step |

---

### 3.3 Finding / Issue Severity Classifications

Consistently used across code review, security scanning, static analysis, and AI analysis:

**Severity Enum (5-level, industry standard):**
```
Severity:
  "critical"    — Must fix before merge/release, security risk or data loss
  "high"        — Should fix before merge, significant correctness issue
  "medium"      — Should fix, code quality or maintainability concern
  "low"         — Nice to fix, minor improvement
  "info"        — Observation, no action required
```

**Finding Category Enum:**
```
FindingCategory:
  "correctness"       — Logic errors, wrong behavior
  "security"          — Vulnerabilities, exposure risks
  "performance"       — Bottlenecks, N+1 queries, memory leaks
  "reliability"       — Error handling, race conditions, resource cleanup
  "maintainability"   — Code complexity, duplication, naming
  "style"             — Formatting, conventions
  "documentation"     — Missing/incorrect docs
  "architecture"      — Design pattern violations, coupling
  "testing"           — Missing tests, test quality
  "accessibility"     — UI accessibility issues
  "compatibility"     — Cross-platform, browser, API compatibility
```

**Finding Source Enum (who/what produced it):**
```
FindingSource:
  "gate-check"      — Automated quality gate
  "code-review"     — Human or agent review
  "static-analysis" — Linter/SAST tool
  "security-scan"   — Security scanner
  "test-failure"    — Failing test case
  "runtime-error"   — Error during execution
  "ai-analysis"     — AI agent analysis phase
```

---

### 3.4 Task Categorization

From CI/CD systems, project management, and AI orchestration:

**Task Type Enum:**
```
TaskType:
  "implement"       — Write new code
  "fix"             — Fix a defect or finding
  "refactor"        — Restructure without behavior change
  "test"            — Write or update tests
  "document"        — Write or update documentation
  "configure"       — Configuration/infra changes
  "investigate"     — Research or spike
  "review"          — Perform a review
  "validate"        — Run validation/verification
  "deploy"          — Deploy to an environment
```

**Task Status Enum:**
```
TaskStatus:
  "not-started"
  "in-progress"
  "completed"
  "blocked"
  "skipped"
  "failed"
```

**Task Source Enum (what generated the task):**
```
TaskSource:
  "plan"            — Created during planning phase
  "gate-failure"    — Created from a failed quality gate
  "review-finding"  — Created from a review finding
  "analysis"        — Created from AI analysis
  "manual"          — Manually created by user
  "regression"      — Created from a regression detection
```

---

### 3.5 Actor / Agent Classification

For audit trails in multi-agent systems:

```
ActorKind:
  "coordinator"     — Orchestrating agent
  "subagent"        — Delegated specialist agent
  "human"           — Human user
  "ci-system"       — Automated CI/CD system
  "tool"            — MCP or other tool
```

---

## 4) Patterns from Specific Systems

### 4.1 SonarQube Quality Gate Conditions

SonarQube gates are composed of metric + operator + threshold:

| Metric | Operator | Threshold | Example |
|--------|----------|-----------|---------|
| `new_coverage` | `<` | `80.0` | New code coverage must be ≥ 80% |
| `new_duplicated_lines_density` | `>` | `3.0` | Duplicated lines on new code ≤ 3% |
| `new_blocker_violations` | `>` | `0` | Zero blocker issues on new code |
| `new_critical_violations` | `>` | `0` | Zero critical issues on new code |
| `new_reliability_rating` | `>` | `1` | Reliability rating A on new code |
| `new_security_rating` | `>` | `1` | Security rating A on new code |
| `new_maintainability_rating` | `>` | `1` | Maintainability rating A on new code |

**Takeaway:** Quality gates are metric-based with configurable thresholds. The MCP service could support a similar `MetricCondition` model: `{ metric: string, operator: "lt"|"gt"|"eq"|"lte"|"gte", threshold: number, actual: number, met: boolean }`.

---

### 4.2 GitHub Actions Check Runs

GitHub checks use:
- `status`: `"queued" | "in_progress" | "completed"`
- `conclusion`: `"success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required" | "skipped" | "stale"`
- `output`: `{ title, summary, text, annotations[] }`
- Annotations: `{ path, start_line, end_line, annotation_level: "notice"|"warning"|"failure", message }`

**Takeaway:** The annotation model (file + line + level + message) is a widely understood pattern for findings.

---

### 4.3 Azure DevOps Gates

Azure DevOps release gates support:
- **Invoke Azure Function** — call HTTP endpoint, evaluate response
- **Query Azure Monitor alerts** — zero alerts = pass
- **Invoke REST API** — check response against success criteria
- **Query Work Items** — zero bugs = pass
- **Approval** — human approval with timeout

Gate evaluation: `{ sampleInterval, minDuration, timeout }` — gates are polled repeatedly until they pass or timeout.

**Takeaway:** Some evidence types are "eventually consistent" — they need polling. The MCP service evidence model should support `pending` state for evidence that hasn't resolved yet.

---

### 4.4 Temporal Workflow Engine

Temporal uses structured signals and queries:
- **Activities** return typed results (success + payload or failure + error)
- **Signals** are typed events sent to running workflows
- **Queries** return current state without side effects
- **Search attributes** are typed key-value pairs for workflow discovery

**Takeaway:** The separation of "query state" (read-only) vs. "signal/activity" (write) maps directly to your `get_state`/`get_events` vs. `append_event`/`transition` tool split.

---

### 4.5 AWS Step Functions

Step Functions define:
- **Task states** with `ResultSelector` and `ResultPath` for shaping output
- **Choice states** with typed comparison operators: `StringEquals`, `NumericGreaterThan`, `BooleanEquals`, `IsPresent`, `IsNumeric`
- **Error handling** via `Catch` and `Retry` with typed error names

**Takeaway:** Typed comparison operators for gate conditions are proven at scale.

---

### 4.6 LangGraph / CrewAI / AutoGen

AI agent orchestration patterns:

| System | Evidence Pattern | Fields |
|--------|-----------------|--------|
| **LangGraph** | Node outputs are typed state updates; conditional edges evaluate state | `{ state_key: value }` per node |
| **CrewAI** | Task results with `output`, `raw`, `pydantic` (structured), `json_dict` | `{ description, expected_output, actual_output, agent }` |
| **AutoGen** | Message-based with typed content: `TextMessage`, `ToolCallMessage`, `ToolCallResultMessage` | `{ source, content, type }` |

**Takeaway for your system:** AI agent evidence should capture both the structured output (for gate evaluation) and a human-readable summary (for audit/display). Your `agent-completion` evidence type already does this well.

---

## 5) Recommended Evidence Schema Architecture

### 5.1 Common Envelope (all evidence)

```
EvidenceEnvelope:
  evidenceId: string         // Unique ID
  workflowId: string         // Parent workflow
  phaseKey: string           // Which phase this relates to
  category: EvidenceCategory // Discriminator
  submittedBy: string        // Actor name
  submittedAt: string        // ISO-8601
  gateResult: "pass" | "fail" | "warn" | "pending"  // Unified result
  data: <category-specific>  // Typed payload
```

### 5.2 Gate Evaluation Rule

```
GateRule:
  gateId: string
  phaseTransition: { from: PhaseKey, to: PhaseKey }
  requiredEvidence: RequiredEvidence[]

RequiredEvidence:
  category: EvidenceCategory
  condition: "must-pass" | "should-pass" | "informational"
  description: string
```

This allows the `transition()` tool to:
1. Look up required evidence for the requested transition
2. Check that all `must-pass` evidence exists with `gateResult === "pass"`
3. Warn on missing `should-pass` evidence
4. Proceed regardless of `informational` evidence

---

## 6) Mapping to Your Existing Workflow Phases

| Phase Transition | Recommended Required Evidence |
|-----------------|-------------------------------|
| research → specification | `checklist` (research completeness) |
| specification → plan | `artifact-validation` (spec doc exists), `checklist` (spec quality) |
| plan → tasks | `artifact-validation` (plan doc exists), `checklist` (plan completeness) |
| tasks → analyze | `artifact-validation` (task list exists) |
| analyze → implement | `agent-completion` (analysis done), `checklist` (analysis findings reviewed) |
| implement → review | `test-results`, `error-diagnostic` (zero errors), `static-analysis`, `build-result` |
| review → validate | `code-review` (approved or zero criticals), `checklist` (review checklist) |
| validate → document | `test-results` (final pass), `compliance` (constitution check), `checklist` |
| document → close | `artifact-validation` (docs exist), `checklist` (documentation completeness) |

---

## 7) Summary & Recommendations

1. **Start with 5 core evidence types:** `test-results`, `error-diagnostic`, `checklist`, `agent-completion`, `code-review`. These cover your immediate workflow needs.

2. **Add a `custom` catch-all** with freeform `payload: object` for extensibility without schema changes.

3. **Use a common envelope** with a discriminated `category` field. This enables the MCP tool to validate evidence shape per category while keeping the tool surface minimal (`workflow.submit_evidence(workflowId, evidence)`).

4. **Derive `gateResult`** from category-specific logic (e.g., `failed === 0` for tests, `verdict === "approved"` for reviews) rather than trusting callers to set it correctly.

5. **Type your events** with a closed enum of event types plus typed payloads. This is the pattern used by CloudEvents, Temporal, and every mature event-sourced system.

6. **Type your findings** with severity and category enums. These are stable across the industry and your agents already use a subset.

7. **Type your task classification** with source/type/status enums to enable querying and reporting.

8. **Consider `MetricCondition`** as a reusable building block for numeric gate checks (SonarQube pattern): `{ metric, operator, threshold, actual, met }`.
