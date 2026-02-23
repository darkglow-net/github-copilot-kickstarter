---
agent: "agent"
description: "Coordinator for specification-driven feature development using SpecKit subagents."
---

# Specification-Driven Development Workflow

**Purpose**: Coordinator orchestrates SpecKit subagents for specification-driven feature development.

**Pattern**: Coordinator → Subagent → Results → Coordinator → Next Subagent. Subagents NEVER call other subagents.

**When to use**: New capabilities requiring database schema changes, new UI components, architecture decisions, or 4+ files modified (complexity score ≥ 4).

**When NOT to use**: Bug fixes, refactors, documentation, routine multi-file changes (complexity score ≤ 3). Use `workon.myidea.prompt.md` instead.

**Prerequisites**: SpecKit framework installed (`.specify/` directory with templates and scripts).

---

## Project Configuration

Customize this section for your workspace. The workflow references these settings by name.

### Agents (SpecKit — required)

| Role | Agent | Purpose |
|------|-------|---------|
| Specification | `speckit.specify` | Creates spec + branch via `.specify/` scripts |
| Planning | `speckit.plan` | Generates design artifacts (plan.md, research.md, data-model.md) |
| Task Generation | `speckit.tasks` | Breaks plan into dependency-ordered tasks |
| Implementation | `speckit.implement` | Executes task plan phase-by-phase |
| Code Review | `code-review` | Fresh-context validation and compliance check |

### Agents (Specialized — optional)

<!--
  Add specialized agents your project uses. Examples:
  | Role | Agent | When to Use |
  |------|-------|-------------|
  | Security Review | `SE: Security` | Phase 5 — security-sensitive features |
  | TDD: Write Tests | `TDD Red Phase` | Phase 4 — dedicated test writing |
  | TDD: Implement | `TDD Green Phase` | Phase 4 — make failing tests pass |
  | TDD: Refactor | `TDD Refactor Phase` | Phase 4 — improve quality |
  | Documentation | `SE: Tech Writer` | Phase 7 — user-facing docs |
  | ADR | `ADR Generator` | Phase 7 — architectural decisions |
  | Debug | `debug.mode` | Any phase — stuck on a specific bug |
  Remove this comment block after customizing.
-->

### Test & Validation

| Action | Command | Notes |
|--------|---------|-------|
| Run tests | `Invoke-Build Test` | Replace with your test runner (e.g., `npm test`, `pytest`, `dotnet test`) |
| Check errors | `get_errors` tool | Built-in Copilot tool — works in all workspaces |

### Project Paths (adjust to match your repo)

| Path | Purpose |
|------|---------|
| `specs/` | Feature specification directories |
| `docs/adr/` | Architecture Decision Records (optional) |
| `docs/` | Project documentation root (optional) |

### MCP Tools (use when available, skip when not)

| Need | Tool | Fallback if unavailable |
|------|------|-------------------------|
| Microsoft/.NET docs | `mcp_microsoftdocs_microsoft_docs_search` | Web search or training data |
| Library/framework docs | `mcp_context7_resolve-library-id` → `get-library-docs` | Web search |
| Current versions/APIs | `mcp_brave-search_brave_web_search` | Note uncertainty to user |
| Complex reasoning | `mcp_sequential-th_sequentialthinking` | Inline chain-of-thought |

> **Rule**: Never guess API signatures or version numbers. Use MCP tools, web search, or explicitly tell the user the information needs verification.

### Project Rules (optional — adapt or remove)

<!--
  Add project-specific mandatory rules:
  - Test-first development: Write tests before implementation code
  - Constitutional principles: Reference your project constitution if applicable
  - Code style: Reference your linting/formatting standards
  Remove this comment block after customizing.
-->

---

## Hard Rules

- NEVER proceed to Phase 1 without completing Phase 0 (Routing)
- NEVER delegate without using the Delegation Template and Anti-Laziness Addendum
- NEVER skip Phase 6 (Validate) or Phase 7 (Document)
- NEVER use `manage_todo_list` as source of truth — it is display-only (after PROGRESS.json exists)
- ALWAYS execute the Phase Transition Protocol between phases (after PROGRESS.json exists)
- ALWAYS read PROGRESS.json before each phase transition
- PROGRESS.json is the **sole authoritative state store** for workflow progress (created in Phase 2)
- Subagents NEVER call other subagents — all coordination flows through the coordinator

---

## Phase 0: Routing & Initialization

### Session Resumption

Before anything else, check for an active spec workflow:

1. Scan `specs/*/PROGRESS.json` for any file with an in-progress phase
2. **If found**: Read it. Report feature name, branch, current phase, and remaining phases. Resume from the in-progress phase.
3. **If not found**: Check if on a feature branch (not main/master)
   - If on feature branch: investigate `specs/` for partial artifacts. Report state to user.
   - If on main/master: New workflow. Proceed with qualification below.

### Complexity Confirmation

Score the work to confirm it belongs in this workflow:

| Factor | Score |
|--------|-------|
| Files affected: 1-3 | 0 |
| Files affected: 4-8 | +2 |
| Files affected: 9+ | +4 |
| Database/schema changes | +2 |
| New UI components | +2 |
| Cross-layer changes (e.g., API + UI + DB) | +2 |
| Architecture decisions needed | +3 |

| Score | Workflow | Action |
|-------|----------|--------|
| **0-3** | `workon.myidea` | Route back: "This work is lightweight (score X). Use `workon.myidea.prompt.md`." **EXIT** |
| **4-7** | This prompt (standard) | Continue with standard ceremony |
| **8+** | This prompt (extended) | Continue. Add security review and performance review to Phase 5 |

Confirm user wants full specification workflow before proceeding.

### Initialize Todo Display

Initialize `manage_todo_list` with all 8 phases. PROGRESS.json does not exist yet — it is created after Phase 2 (Specification). Until then, `manage_todo_list` is the temporary display mechanism.

```javascript
{ id: 1, title: "Phase 1: Research",       status: "in-progress" },
{ id: 2, title: "Phase 2: Specification",  status: "not-started" },
{ id: 3, title: "Phase 3a: Plan",          status: "not-started" },
{ id: 4, title: "Phase 3b: Tasks",         status: "not-started" },
{ id: 5, title: "Phase 4: Implement",      status: "not-started" },
{ id: 6, title: "Phase 5: Code Review",    status: "not-started" },
{ id: 7, title: "Phase 6: Validate",       status: "not-started" },
{ id: 8, title: "Phase 7: Document",       status: "not-started" }
```

---

## State Management

### PROGRESS.json

**Location**: `{spec-directory}/PROGRESS.json` (created by coordinator after Phase 2)

**Authority**: Once created, this file is the single source of truth for workflow state. All phase tracking reads and writes go through this file.

**Schema**:

```json
{
  "feature": "{feature-name}",
  "branch": "{branch-name}",
  "spec": "{spec-file-path}",
  "complexityScore": 0,
  "startedAt": "{ISO-8601}",
  "phases": {
    "research":      { "status": "completed", "startedAt": "{ISO-8601}", "completedAt": "{ISO-8601}", "summary": "{research summary}" },
    "specification": { "status": "completed", "startedAt": "{ISO-8601}", "completedAt": "{ISO-8601}", "summary": "spec.md created" },
    "plan":          { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "tasks":         { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "implement":     { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "review":        { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null, "attempts": 0, "maxAttempts": 2, "findings": [], "rubricScores": null },
    "validate":      { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "document":      { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null }
  },
  "tasks": [],
  "context": {
    "affectedModules": ["{list from Phase 1 research}"],
    "priorSpecs": ["{related spec names}"],
    "constraints": ["{applicable constraints}"],
    "researchNotes": "{key findings from Phase 1}"
  },
  "haltReason": null
}
```

**Schema notes**:
- `phases.*.status`: `"not-started"` | `"in-progress"` | `"completed"` | `"blocked"`
- `tasks[]`: Dynamic implementation/fix tasks — `{ "id": 100, "title": "...", "status": "not-started|in-progress|completed" }`
- `review.findings[]`: `{ "severity": "critical|high|medium|low", "file": "path", "description": "...", "requirement": "FR-### or null" }`
- `review.rubricScores`: `{ "correctness": N, "robustness": N, "simplicity": N, "maintainability": N, "consistency": N }` or `null`
- `context`: Persists Phase 1 research across sessions — populate from coordinator research
- `haltReason`: Set when workflow stops unexpectedly. Describes what is needed to resume.
- Timestamps: ISO 8601 format (e.g., `"2026-02-20T10:30:00Z"`)

**Creation timing**: PROGRESS.json is created by the coordinator immediately after Phase 2 (Specification) completes — this is when the spec directory first exists. Phases 1 and 2 are marked retroactively as completed during creation.

### Phase Transition Protocol

**Execute between EVERY phase transition** (after PROGRESS.json exists — Phase 2 onward).

1. **READ**: Read `{spec-directory}/PROGRESS.json`
2. **VERIFY**: Confirm all remaining phases exist with correct status
3. **UPDATE**:
   - Set current phase `status` to `"completed"` with `completedAt` and `summary`
   - Set next phase `status` to `"in-progress"` with `startedAt`
   - Confirm remaining phases are `"not-started"`
4. **WRITE**: Write updated PROGRESS.json to disk
5. **DISPLAY**: Derive `manage_todo_list` from PROGRESS.json (see Display Derivation below)
6. **REPORT**: "Phase X complete → Phase Y. Remaining: [list remaining phases]"

⚠️ If PROGRESS.json is missing or corrupted, HALT and recreate from the last known state before proceeding.

### Display Derivation (manage_todo_list)

`manage_todo_list` is a **display-only projection** of PROGRESS.json. Never treat it as source of truth.

Map PROGRESS.json to the todo list:

```javascript
{ id: 1, title: "Phase 1: Research",       status: phases.research.status },
{ id: 2, title: "Phase 2: Specification",  status: phases.specification.status },
{ id: 3, title: "Phase 3a: Plan",          status: phases.plan.status },
{ id: 4, title: "Phase 3b: Tasks",         status: phases.tasks.status },
{ id: 5, title: "Phase 4: Implement",      status: phases.implement.status },
{ id: 6, title: "Phase 5: Code Review",    status: phases.review.status },
// Dynamic tasks from PROGRESS.json tasks[] — IDs 100+
{ id: 7, title: "Phase 6: Validate",       status: phases.validate.status },
{ id: 8, title: "Phase 7: Document",       status: phases.document.status }
```

---

## Delegation Standards

### Delegation Template (required for ALL subagent calls)

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: [specific decomposed task for this subagent]
SCOPE:
- Files to analyze/modify: [list]
- Files to create: [list]
- Files to NOT touch: [list]
REQUIREMENTS:
1. [numbered requirement]
2. [numbered requirement]
ACCEPTANCE CRITERIA:
- [ ] [checkable criterion]
- [ ] [checkable criterion]
CONSTRAINTS:
- [what NOT to do]
- [boundaries of the subagent's responsibility]
WHEN DONE: Report: files created/modified, summary of changes, issues found, confirmation of each acceptance criterion.
```

### Anti-Laziness Addendum (append to every delegation)

```
Do NOT return until every requirement is fully implemented.
Partial work is not acceptable. DO NOT skip any requirement.
You MUST complete ALL acceptance criteria.
Confirm each acceptance criterion individually in your response.
```

### Subagent Rules

- Subagents **analyze and distill** — never use them to relay raw file contents back
- Delegate for: cross-subsystem analysis, large file (500+ line) extraction, specialized work (TDD, review, security), MCP knowledge distillation
- Read directly when: you'll edit the file, files are small/related, or ≤ 3 files in one subsystem
- If you need full contents, read them yourself — a subagent returning unmodified file contents wastes both contexts
- Subagents NEVER call other subagents — all coordination flows through the coordinator

---

## Quality Gates

### Self-Reflection Rubric (Pre-Review)

Before delegating to Code Review (Phase 5), the coordinator scores the implementation:

| Category | Question | Score (1-10) |
|----------|----------|-------------|
| Correctness | Does it meet the explicit requirements? | |
| Robustness | Does it handle edge cases and errors? | |
| Simplicity | Is it free of over-engineering? | |
| Maintainability | Can another developer extend/debug it? | |
| Consistency | Does it follow project conventions? | |

**Pass**: All categories ≥ 7 → proceed to Code Review delegation
**Fail**: Any category < 7 → create fix tasks in PROGRESS.json, return to Phase 4
**Max iterations**: 3 rubric attempts → mark phase FAILED, escalate to user

Record scores in PROGRESS.json `review.rubricScores`.

### Post-Phase Validation

Run validation checks after these phases before transitioning:

| After Phase | Validation Steps |
|-------------|-----------------|
| Phase 4 (Implement) | Verify all tasks in tasks.md are `[X]`. Run tests. Run `get_errors`. All must pass. |
| Phase 5 (Code Review) | If rejection cycle: verify fix tasks addressed. Confirm in PROGRESS.json. |
| Phase 6 (Validate) | Full validation: tests, errors, spec compliance, task audit. Must pass before Phase 7. |

If post-phase validation fails, report specific failures. User decides next step (fix, proceed, or halt).

---

## Phase 1: Coordinator Research

**Coordinator executes directly** — DO NOT delegate research. You need this context for Phase 2 handoff.

### Research Steps

1. **CLASSIFY**: "This is a [scope/size] feature affecting [components]."
2. **SCOPE**: Identify affected files/modules via `grep_search` or `semantic_search`
3. **RESEARCH**:
   - Read existing patterns in affected modules
   - Check specs directory for related prior work
   - Check ADR directory for architectural constraints (if it exists)
   - Read project navigation/architecture docs (if they exist)
4. **External knowledge**: Use MCP tools from Configuration section when available. Skip unavailable tools.
5. **Clarify ambiguities**: For 2+ valid interpretations, ask ONE question with researched options

**Output**: Research summary — affected modules, existing patterns, prior specs, constraints.

Report research summary to user. Update `manage_todo_list` display (Phase 1 complete, Phase 2 in-progress).

---

## Phase 2: Specification

**Delegate to**: `speckit.specify` agent

### Delegation Prompt

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: Create a feature specification and branch using the .specify/ scripts.
SCOPE:
- Working directory: {project root}
- Spec output directory: specs/
REQUIREMENTS:
1. Generate branch name from feature description
2. Create feature branch
3. Generate specification document (spec.md) using .specify/ templates
4. Populate all specification sections with substantive content
5. Define testable, measurable success criteria
ACCEPTANCE CRITERIA:
- [ ] Feature branch created and checked out
- [ ] spec.md created with complete specification
- [ ] All sections filled with substantive content (no placeholders)
- [ ] Success criteria are testable and measurable
- [ ] Functional requirements have unique IDs (FR-###)
CONSTRAINTS:
- Do NOT create implementation code
- Do NOT create plan or task documents
- The specification defines WHAT, not HOW
WHEN DONE: Report: branch name, spec file path, spec number, section summary, checklist results.
```

Append Anti-Laziness Addendum.

### Coordinator Post-Delegation

1. Verify branch: `git branch --show-current` — HALT if not on feature branch
2. Verify spec file exists and contains complete specification
3. **Create PROGRESS.json** in the spec directory (see State Management → Schema)
   - Mark `research` and `specification` as `"completed"` (retroactively)
   - Mark `plan` as `"in-progress"`
   - Populate `context` from Phase 1 research output

Execute Phase Transition Protocol.

---

## Phase 3: Planning

### Phase 3a: Implementation Plan

**Delegate to**: `speckit.plan` agent

#### Delegation Prompt

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: Generate implementation plan documents from the specification.
SCOPE:
- Spec file: {spec file path}
- Feature directory: {spec directory}
REQUIREMENTS:
1. Generate plan.md with implementation approach, timeline, dependencies
2. Generate research.md with technical findings and alternatives considered
3. Generate data-model.md if specification mentions schema/data changes
4. Generate quickstart.md for developer onboarding
ACCEPTANCE CRITERIA:
- [ ] plan.md exists with approach, timeline, and dependencies
- [ ] research.md covers technology choices and alternatives
- [ ] data-model.md exists if spec mentions schema changes
- [ ] Documents are consistent with the specification
CONSTRAINTS:
- Do NOT modify the specification (spec.md)
- Do NOT create implementation code
- Do NOT create task breakdowns (that is the next phase)
WHEN DONE: Report: documents created, implementation approach summary, key technical decisions.
```

Append Anti-Laziness Addendum.

**Coordinator verifies**: plan.md exists in spec directory with substantive content.

Execute Phase Transition Protocol.

### Phase 3b: Task Generation

**Delegate to**: `speckit.tasks` agent

#### Delegation Prompt

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: Break the implementation plan into dependency-ordered tasks.
SCOPE:
- Feature directory: {spec directory}
- Design docs: {list: spec.md, plan.md, research.md, data-model.md, etc.}
REQUIREMENTS:
1. Generate tasks.md with checkbox task format ([ ] ID: title)
2. Tasks must be dependency-ordered (no task depends on a later one)
3. Each task must reference specific files to create or modify
4. Include test tasks before their corresponding implementation tasks (test-first)
5. {project-specific test requirements from Configuration → Project Rules}
ACCEPTANCE CRITERIA:
- [ ] tasks.md exists with proper checkbox format
- [ ] Every task has a unique ID, title, and file references
- [ ] Tasks are ordered by dependency
- [ ] Test tasks precede implementation tasks
CONSTRAINTS:
- Do NOT implement any tasks
- Do NOT modify spec or plan documents
WHEN DONE: Report: task count, dependency summary, estimated complexity.
```

Append Anti-Laziness Addendum.

**Coordinator verifies**: tasks.md exists with proper task format (checkboxes, IDs, file paths).

Execute Phase Transition Protocol.

---

## Phase 4: Implementation

**Delegate to**: `speckit.implement` agent

### Delegation Prompt

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: Execute all tasks in the implementation plan.
SCOPE:
- Tasks file: {tasks.md path}
- Design docs: {spec.md, plan.md, research.md, data-model.md paths}
- Project rules: {from Configuration → Project Rules section}
REQUIREMENTS:
1. Execute tasks in dependency order
2. Write tests BEFORE implementation code (test-first)
3. Mark each completed task [X] in tasks.md
4. Use MCP tools for external library/API verification — do NOT rely on training data
ACCEPTANCE CRITERIA:
- [ ] All tasks in tasks.md marked [X]
- [ ] Tests exist for all new functionality
- [ ] All tests pass
- [ ] No lint/compile errors in modified files
CONSTRAINTS:
- Do NOT modify spec.md or plan.md
- Do NOT proceed to code review — return to coordinator after implementation
- After implementation, the coordinator proceeds to Phase 5 (Code Review), Phase 6 (Validate), and Phase 7 (Document). You do NOT manage these phases.
WHEN DONE: Report: files created/modified, test results summary, task completion status, issues encountered.
```

Append Anti-Laziness Addendum.

**TDD Agent Alternative**: For features with complex logic, the coordinator MAY delegate the test-first cycle to TDD agents instead of (or in addition to) speckit.implement:
1. `TDD Red Phase` — write failing tests from task requirements
2. `TDD Green Phase` — implement minimal code to pass tests
3. `TDD Refactor Phase` — improve quality while maintaining green tests

### Coordinator Post-Delegation

1. Verify all tasks in tasks.md are marked complete (`[X]`)
2. **Run Post-Phase Validation**: Run tests + `get_errors` on modified files
3. Read PROGRESS.json — verify phases review/validate/document are still `"not-started"`

Execute Phase Transition Protocol.

---

## Phase 5: Code Review

### Pre-Review Self-Check

1. Run **Self-Reflection Rubric** (see Quality Gates)
2. If any score < 7: create fix tasks in PROGRESS.json, return to Phase 4
3. If all scores ≥ 7: proceed to delegation

### Pre-Review Error Check

Run `get_errors` on all modified files BEFORE delegating. Include findings in the delegation prompt — the review agent cannot access IDE diagnostics.

### Delegate to Code Review Agent

**Optional: Security Review** — If the feature touches security-sensitive areas (authentication, file I/O, network, user input), additionally delegate to a security-focused review agent. Security findings feed into the same verdict flow.

**Attempts tracked**: PROGRESS.json `review.attempts` field. Maximum 2 attempts before escalation.

#### Delegation Prompt

```markdown
CONTEXT: The user asked: "[objective]"
YOUR TASK: Review code changes for quality, security, correctness, and spec compliance.
SCOPE:
- Spec file: {spec path}
- Branch: {branch name}
- Files modified: [list from get_changed_files]
- Files to NOT touch: [all other files]
REQUIREMENTS:
1. Verify spec compliance: check each functional requirement (FR-###)
2. Verify success criteria from spec are met
3. Check for security vulnerabilities
4. Verify test coverage for new/changed code
5. Check error handling completeness
6. Verify adherence to project conventions
7. Identify performance concerns
ACCEPTANCE CRITERIA:
- [ ] Every modified file reviewed
- [ ] Spec compliance verified for each FR-### requirement
- [ ] Severity assigned to each finding (critical/high/medium/low)
- [ ] Specific line references for each finding
- [ ] Suggested fix for each critical/high finding
CONSTRAINTS:
- Do NOT modify any files
- Review ONLY the files listed in scope
- Base review on spec requirements and project conventions, not personal preference
WHEN DONE: Report verdict (APPROVED/CONDITIONAL/REJECTED), spec compliance checklist, all findings with severity, fix suggestions for critical/high issues.
```

Append Anti-Laziness Addendum.

### Verdict Handling

| Verdict | Criteria | Action |
|---------|----------|--------|
| **APPROVED** | 0 critical/high issues | Proceed to Phase 6 |
| **CONDITIONAL** | 1-3 critical/high issues | User decides: accept or revise |
| **REJECTED** | 4+ critical/high issues | See Rejection Handling |

### Rejection Handling

1. Increment `review.attempts` in PROGRESS.json. Append findings to `review.findings[]`.
2. **If attempt ≤ 2**: Add fix tasks to PROGRESS.json `tasks[]`. Return to Phase 4 with fix tasks only.
3. **If attempt > 2**: **HALT** — escalate to user with full analysis across all attempts. Options: manual fix, reduce scope, accept as-is, abandon review.

Execute Phase Transition Protocol after APPROVED or CONDITIONAL-accepted.

---

## Phase 6: Validate

**Coordinator executes directly.** MANDATORY — do not skip even if code review passed.

### Validation Steps

1. **Run tests**: Execute test command from Configuration section
   - If tests fail: report failures with details. User decides next step.
2. **Check errors**: Run `get_errors` on all modified files
   - Report remaining lint/compile errors with file paths
3. **Spec compliance**: Read spec.md Success Criteria and cross-reference against implementation
   - For each criterion: ✅ Met | ❌ Not met | ⚠️ Partially met
4. **Task audit**: Verify all tasks in tasks.md are marked `[X]`

### Validation Report

```
Validation Results:
- Tests: [PASS/FAIL] — [summary]
- Errors: [count] lint/compile issues remaining
- Spec Criteria: [N/M] success criteria met
- Tasks: [N/M] tasks complete
- Overall: [PASS/FAIL]
```

If validation fails, report specific failures. User decides whether to fix or proceed.

Execute Phase Transition Protocol.

---

## Phase 7: Document

**Coordinator executes directly.** MANDATORY — do not skip even for "internal" features.

### Documentation Steps

1. **Spec updates**: If requirements changed during implementation, update spec.md to reflect actuals
2. **Architecture docs**: If new components, patterns, or integrations were added:
   - Update relevant architecture documentation (if it exists)
   - If a significant architectural decision was made, consider delegating to `ADR Generator`
3. **User-facing docs**: If the feature changes user-visible behavior:
   - Consider delegating to `SE: Tech Writer` for documentation updates
   - Add usage examples if applicable
4. **Finalize PROGRESS.json**: Mark all phases `"completed"`, set `haltReason` to `null`, add final summary

### Documentation Report

```
Documentation Updates:
- Files updated: [list or "none"]
- ADR created: [yes/no — title if yes]
- User docs updated: [yes/no — what changed]
```

---

## Completion Checklist

- [ ] spec.md, plan.md, tasks.md created in spec directory
- [ ] All tasks completed, all tests passing
- [ ] Code review APPROVED or CONDITIONAL (accepted by user)
- [ ] No lint/compile errors
- [ ] Spec success criteria validated
- [ ] Documentation updated (or justified as unnecessary)
- [ ] PROGRESS.json shows all phases `"completed"`

**Final Report**: Spec number, branch, implementation summary, test results, documentation changes, next steps (merge/PR).

---

## Error Handling

| Scenario | Action |
|----------|--------|
| PROGRESS.json missing/corrupted | HALT — recreate from last known state |
| Subagent returns incomplete output | Verify file(s) exist. Use partial output, note gaps, ask user |
| Test failures in Phase 4 | Normal TDD — fix in implementation. Not a workflow error |
| Rubric fail (attempt ≤ 3) | Create fix tasks, return to Phase 4 |
| Rubric fail (attempt > 3) | HALT — escalate to user |
| Code review REJECTED (attempt ≤ 2) | Add fix tasks to PROGRESS.json, return to Phase 4 |
| Code review REJECTED (attempt > 2) | **HALT** — escalate to user with full analysis |
| Post-phase validation fails | Report failures. User decides next step |
| Branch not on feature branch | HALT — resolve git state before continuing |
| MCP tool unavailable | Use fallback from Configuration table. Note limitation to user |
