---
agent: "agent"
description: "Structured workflow for bug fixes, small features, and refactors. Routes large features to workon.spec.prompt.md."
---

## Objective

[State what you want to accomplish in 1-2 sentences]

---

## Project Configuration

Customize this section for your workspace.

### Test & Validation

| Action | Command | Notes |
|--------|---------|-------|
| Run tests | `Invoke-Build Test` | Replace with your test runner (e.g., `npm test`, `pytest`, `dotnet test`) |
| Check errors | `get_errors` tool | Built-in Copilot tool — works in all workspaces |

### MCP Tools (use when available, skip when not)

| Need | Tool | Fallback if unavailable |
|------|------|-------------------------|
| Microsoft/.NET docs | `mcp_microsoftdocs_microsoft_docs_search` | Web search or training data |
| Library/framework docs | `mcp_context7_resolve-library-id` → `get-library-docs` | Web search |
| Current versions/APIs | `mcp_brave-search_brave_web_search` | Note uncertainty to user |

> **Rule**: Never guess API signatures or version numbers. Use MCP tools or explicitly note uncertainty.

---

## Hard Rules

- NEVER proceed to Phase 1 without completing Phase 0 (Classification + Initialization)
- NEVER skip Phase 5 (Validate) or Phase 6 (Document)
- NEVER delegate without using the Delegation Template and Anti-Laziness Addendum
- NEVER use `manage_todo_list` as source of truth — it is display-only
- ALWAYS execute the Phase Transition Protocol between phases
- ALWAYS read `.progress/PROGRESS.json` before each phase transition
- PROGRESS.json is the **sole authoritative state store** for workflow progress

---

## Phase 0: Work Classification & Initialization

### Session Resumption

Before anything else, check for an active workflow:

1. Check if `.progress/PROGRESS.json` exists
2. **If YES**: Read it. Report current state to user. Resume from the in-progress phase.
3. **If NO**: New workflow. Proceed with classification below.

### Complexity Scoring

Score the work to determine the correct workflow:

| Factor | Score |
|--------|-------|
| Files affected: 1-3 | 0 |
| Files affected: 4-8 | +2 |
| Files affected: 9+ | +4 |
| Database/schema changes | +2 |
| New UI components | +2 |
| Cross-layer changes (e.g., API + UI + DB) | +2 |
| Architecture decisions needed | +3 |

### Routing Decision

| Score | Workflow | Action |
|-------|----------|--------|
| **0-3** | This prompt (lightweight) | Continue to Initialize State |
| **4-7** | `workon.spec` (standard) | Report score and rationale. Instruct user to reinvoke with `workon.spec.prompt.md`. **EXIT** |
| **8+** | `workon.spec` (extended) | Report score. Recommend spec workflow with security + performance review. **EXIT** |

### Initialize State

Create `.progress/PROGRESS.json`:

```json
{
  "feature": "{objective from user}",
  "type": "{bug-fix|small-feature|refactor}",
  "complexityScore": 0,
  "startedAt": "{ISO-8601}",
  "phases": {
    "research":  { "status": "in-progress", "startedAt": "{ISO-8601}", "completedAt": null, "summary": null },
    "plan":      { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "implement": { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "review":    { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null, "attempts": 0, "maxAttempts": 2, "findings": [], "rubricScores": null },
    "validate":  { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "document":  { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null }
  },
  "tasks": [],
  "context": {
    "affectedFiles": [],
    "researchNotes": ""
  },
  "haltReason": null
}
```

**Schema notes**:
- `phases.*.status`: `"not-started"` | `"in-progress"` | `"completed"` | `"blocked"`
- `tasks[]`: Dynamic implementation/fix tasks — `{ "id": 100, "title": "...", "status": "not-started|in-progress|completed" }`
- `review.findings[]`: `{ "severity": "critical|high|medium|low", "file": "path", "description": "..." }`
- `review.rubricScores`: `{ "correctness": N, "robustness": N, "simplicity": N, "maintainability": N, "consistency": N }` or `null`
- `context`: Persists Phase 1 research across sessions — populate from research output
- `haltReason`: Set when workflow stops unexpectedly. Describes what is needed to resume.
- Timestamps: ISO 8601 format (e.g., `"2026-02-20T10:30:00Z"`)

Write PROGRESS.json to disk. Update `manage_todo_list` display (see Display Derivation). Proceed to Phase 1.

---

## State Management

### Phase Transition Protocol

**Execute between EVERY phase transition.**

1. **READ**: Read `.progress/PROGRESS.json`
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
{ id: 1, title: "Phase 1: Research & Context", status: phases.research.status },
{ id: 2, title: "Phase 2: Plan & Track",       status: phases.plan.status },
{ id: 3, title: "Phase 3: Implement",           status: phases.implement.status },
{ id: 4, title: "Phase 4: Code Review",         status: phases.review.status },
// Dynamic tasks from PROGRESS.json tasks[] — IDs 100+
{ id: 5, title: "Phase 5: Validate",            status: phases.validate.status },
{ id: 6, title: "Phase 6: Document",            status: phases.document.status }
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

### Delegation Decisions

| Scenario | Action |
|----------|--------|
| Phase 1 (Research) | Execute directly — you need this context |
| Phase 2 (Plan) | Execute directly — lightweight |
| Phase 3 (Implement, ≤ 3 files) | Execute directly |
| Phase 3 (Implement, 3+ files or complex) | Delegate to appropriate agent |
| Phase 4 (Code Review) | **ALWAYS delegate** — fresh context required |
| Phase 5 (Validate) | Execute directly |
| Phase 6 (Document) | Execute directly (delegate for large doc changes) |

---

## Quality Gates

### Self-Reflection Rubric (Pre-Review)

Before delegating to Code Review (Phase 4), the coordinator scores the implementation:

| Category | Question | Score (1-10) |
|----------|----------|-------------|
| Correctness | Does it meet the explicit requirements? | |
| Robustness | Does it handle edge cases and errors? | |
| Simplicity | Is it free of over-engineering? | |
| Maintainability | Can another developer extend/debug it? | |
| Consistency | Does it follow project conventions? | |

**Pass**: All categories ≥ 7 → proceed to Code Review delegation
**Fail**: Any category < 7 → create fix tasks in PROGRESS.json, return to Phase 3
**Max iterations**: 3 rubric attempts → mark phase FAILED, escalate to user

Record scores in PROGRESS.json `review.rubricScores`.

### Post-Phase Validation

Run validation checks after these phases before transitioning:

| After Phase | Validation Steps |
|-------------|-----------------|
| Phase 3 (Implement) | Run tests (Configuration → test command). Run `get_errors` on modified files. Both must pass before Phase 4. |
| Phase 4 (Code Review) | If rejection cycle: verify fix tasks are addressed in PROGRESS.json before re-review. |
| Phase 5 (Validate) | Full validation: tests, errors, task audit. Must pass before Phase 6. |

If post-phase validation fails, report specific failures. User decides next step (fix, proceed, or halt).

---

## Phase 1: Research & Context

**Coordinator executes directly.** Research before implementing.

1. **Classify**: "This is a [type] affecting [components]."
2. **Scope**: Identify affected files/modules via `grep_search` or `semantic_search`
3. **Research**: Read existing patterns in affected modules
4. **Use subagent for research** when 3+ files need reading (docs consume context)
5. **MCP tools**: Use tools from Configuration section when available. Skip tools that are not configured.
6. **Clarify ambiguities**: For 2+ valid interpretations, ask ONE question with researched options

**Update PROGRESS.json**: Populate `context.affectedFiles` and `context.researchNotes`.

Execute Phase Transition Protocol.

---

## Phase 2: Plan & Track

1. Plan test cases before implementation (test-first)
2. Identify files/functions to modify
3. Add discrete implementation tasks to PROGRESS.json `tasks[]`:
   ```json
   { "id": 100, "title": "Add null check to parseUser()", "status": "not-started" }
   ```
4. For complex work: plan subagent delegation strategy
5. Write PROGRESS.json. Update `manage_todo_list` display.

Execute Phase Transition Protocol.

---

## Phase 3: Implement

1. Write tests FIRST (Red phase), then implementation (Green phase)
2. Mark tasks in PROGRESS.json `tasks[]` as `"completed"` as you progress
3. **Verify file writes**: If subagent returns no output, confirm file exists before retrying
4. After all tasks complete: **run Post-Phase Validation** (tests + `get_errors` must pass)

Execute Phase Transition Protocol.

---

## Phase 4: Code Review

### Pre-Review Self-Check

1. Run **Self-Reflection Rubric** (see Quality Gates)
2. If any score < 7: create fix tasks in PROGRESS.json, return to Phase 3
3. If all scores ≥ 7: proceed to delegation

### Pre-Review Error Check

Run `get_errors` on all modified files BEFORE delegating. Include findings in the delegation prompt — the review agent cannot access IDE diagnostics.

### Delegate to Code Review Agent

Use the Delegation Template:

```markdown
CONTEXT: The user asked: "[objective]"
YOUR TASK: Review code changes for quality, security, correctness, and convention compliance.
SCOPE:
- Files modified: [list from PROGRESS.json context.affectedFiles]
- Files to NOT touch: [all other files]
REQUIREMENTS:
1. Check for security vulnerabilities
2. Verify test coverage for new/changed code
3. Check error handling completeness
4. Verify adherence to project conventions
5. Identify performance concerns
ACCEPTANCE CRITERIA:
- [ ] Every modified file reviewed
- [ ] Severity assigned to each finding (critical/high/medium/low)
- [ ] Specific line references for each finding
- [ ] Suggested fix for each critical/high finding
CONSTRAINTS:
- Do NOT modify any files
- Review ONLY the files listed in scope
- Base review on project conventions, not personal preference
WHEN DONE: Report verdict (APPROVED/CONDITIONAL/REJECTED), list all findings with severity, provide fix suggestions for critical/high issues.
```

Append Anti-Laziness Addendum.

### Verdict Handling

| Verdict | Criteria | Action |
|---------|----------|--------|
| **APPROVED** | 0 critical/high issues | Proceed to Phase 5 |
| **CONDITIONAL** | 1-3 critical/high issues | User decides: accept or revise |
| **REJECTED** | 4+ critical/high issues | See Rejection Handling |

### Rejection Handling

1. Increment `review.attempts` in PROGRESS.json. Append findings to `review.findings[]`.
2. **If attempt ≤ 2**: Add fix tasks to PROGRESS.json `tasks[]`. Return to Phase 3 with fix tasks only.
3. **If attempt > 2**: **HALT** — escalate to user with full analysis across all attempts.

Execute Phase Transition Protocol after APPROVED or CONDITIONAL-accepted.

---

## Phase 5: Validate

**Coordinator executes directly.** MANDATORY — do not skip.

1. **Run tests**: Execute test command from Configuration section
   - If tests fail: report failures with details. User decides next step.
2. **Check errors**: Run `get_errors` on all modified files
   - Report any remaining lint/compile errors with file paths
3. **Task audit**: Confirm all tasks in PROGRESS.json are marked `"completed"`
4. **Report**:
   ```
   Validation Results:
   - Tests: [PASS/FAIL] — [summary]
   - Errors: [count] lint/compile issues remaining
   - Tasks: [N/M] complete
   - Overall: [PASS/FAIL]
   ```

Execute Phase Transition Protocol.

---

## Phase 6: Document

**Coordinator executes directly.** MANDATORY — do not skip.

1. **Code docs**: If public APIs changed, update inline documentation
2. **Project docs**: If user-visible behavior changed, update project documentation
3. **Architecture docs**: If architectural patterns changed, update relevant docs
4. **Confirm**: List all docs updated (or state "no doc changes needed" with justification)
5. **Finalize PROGRESS.json**: Mark all phases `"completed"`, set `haltReason` to `null`

---

## Error Handling

| Scenario | Action |
|----------|--------|
| PROGRESS.json missing/corrupted | HALT — recreate from last known state |
| Subagent returns incomplete output | Verify file(s) exist. Use partial output, note gaps, ask user |
| Test failures in Phase 3 | Normal TDD — fix in implementation. Not a workflow error |
| Rubric fail (attempt ≤ 3) | Create fix tasks, return to Phase 3 |
| Rubric fail (attempt > 3) | HALT — escalate to user |
| Code review REJECTED (attempt ≤ 2) | Add fix tasks to PROGRESS.json, return to Phase 3 |
| Code review REJECTED (attempt > 2) | **HALT** — escalate to user with full analysis |
| Post-phase validation fails | Report failures. User decides next step |
| MCP tool unavailable | Use fallback from Configuration table. Note limitation to user |
