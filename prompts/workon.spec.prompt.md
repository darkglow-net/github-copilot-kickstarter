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
| Artifact Analysis | `speckit.analyze` | Cross-artifact consistency and coverage analysis (read-only) |
| Implementation | `speckit.implement` | Executes task plan phase-by-phase |
| Code Review | `code-review` | Fresh-context validation and compliance check |

### Agents (Specialized — optional)

> No specialized agents configured. Add rows to this table when needed (e.g., Security Review, TDD agents, Tech Writer, ADR Generator).

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

> No project-specific rules configured. Add rules when needed (e.g., test-first development, constitutional principles, code style).

---

## Hard Rules

- NEVER proceed to Phase 1 without completing Phase 0 (Routing)
- NEVER delegate without using the Delegation Template and Anti-Laziness Addendum
- NEVER skip Phase 6 (Validate) or Phase 7 (Document)
- Before PROGRESS.json exists (Phases 0–2): `manage_todo_list` is the temporary source of truth
- After PROGRESS.json creation: NEVER use `manage_todo_list` as source of truth — it is display-only
- ALWAYS execute the Phase Transition Protocol between phases (after PROGRESS.json exists)
- ALWAYS read PROGRESS.json before each phase transition
- PROGRESS.json is the **sole authoritative state store** for workflow progress (created in Phase 2)
- Subagents NEVER call other subagents — all coordination flows through the coordinator

---

## Phase 0: Routing & Initialization

### Session Resumption

Before anything else, check for an active spec workflow:

1. Scan `specs/*/PROGRESS.json` for any file with a phase status of `"in-progress"` or `"blocked"`
2. **If found with `"in-progress"`**: Read it. Report feature name, branch, current phase, and remaining phases. Resume from the in-progress phase.
3. **If found with `"blocked"`**: Read it. Report feature name, branch, blocked phase, and `haltReason`. Ask user how to proceed (resolve block, restart phase, or abandon).
4. **If multiple found**: List all with feature names and statuses. Ask user which to resume.
5. **If not found**: Check if on a feature branch (not main/master)
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
| **8+** | This prompt (extended) | Continue. Add security review to Phase 5 |

Confirm user wants full specification workflow before proceeding.

> **Note**: Complexity score is an estimate based on the user's description. After Phase 1 research, re-score if the estimate changed significantly. If the new score ≤ 3, offer to downgrade to `workon.myidea.prompt.md`.

### Initialize Todo Display

Initialize `manage_todo_list` with all 9 phases (see State Management → Display Derivation for the canonical mapping). PROGRESS.json does not exist yet — it is created after Phase 2 (Specification). Until then, `manage_todo_list` is the temporary display mechanism. Set Phase 1 to `"in-progress"`, all others to `"not-started"`.

---

## State Management

### Phase Mapping

All state transitions reference PROGRESS.json phase keys, not phase numbers:

| Display | PROGRESS.json key | Todo ID |
|---------|-------------------|---------|
| Phase 1: Research | `research` | 1 |
| Phase 2: Specification | `specification` | 2 |
| Phase 3a: Plan | `plan` | 3 |
| Phase 3b: Tasks | `tasks` | 4 |
| Phase 3c: Analyze | `analyze` | 5 |
| Phase 4: Implement | `implement` | 6 |
| Phase 5: Code Review | `review` | 7 |
| Phase 6: Validate | `validate` | 8 |
| Phase 7: Document | `document` | 9 |

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
    "analyze":       { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null, "findings": { "critical": 0, "high": 0, "medium": 0, "low": 0 }, "autoResolved": 0, "userResolved": 0 },
    "implement":     { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "review":        { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null, "attempts": 0, "maxAttempts": 2, "rubricAttempts": 0, "maxRubricAttempts": 3, "findings": [], "rubricScores": null },
    "validate":      { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null },
    "document":      { "status": "not-started", "startedAt": null, "completedAt": null, "summary": null }
  },
  "fixTasks": [],
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
- `fixTasks[]`: Fix tasks created during rejection cycles — `{ "id": 100, "title": "...", "status": "not-started|in-progress|completed" }`. Also appended to tasks.md so `speckit.implement` can execute them.
- `review.findings[]`: `{ "severity": "critical|high|medium|low", "file": "path", "description": "...", "requirement": "FR-### or null" }`
- `review.rubricScores`: `{ "correctness": N, "robustness": N, "simplicity": N, "maintainability": N, "consistency": N }` or `null`
- `context`: Persists Phase 1 research across sessions — populate from coordinator research
- `haltReason`: Set when workflow stops unexpectedly. Describes what is needed to resume.
- Timestamps: ISO 8601 format (e.g., `"2026-02-20T10:30:00Z"`)

**Creation timing**: PROGRESS.json is created by the coordinator immediately after Phase 2 (Specification) completes — this is when the spec directory first exists. Phases 1 and 2 are marked retroactively as completed during creation.

### Phase Transition Protocol

**Execute between EVERY phase transition** (after PROGRESS.json exists — Phase 2 onward).

1. **READ + VERIFY**: Read `{spec-directory}/PROGRESS.json`. Confirm all phase statuses are coherent (no unexpected changes).
2. **UPDATE + WRITE**:
   - Set current phase `status` to `"completed"` with `completedAt` and `summary`
   - Set next phase `status` to `"in-progress"` with `startedAt`
   - Write updated PROGRESS.json to disk
3. **REPORT**: "Phase X complete → Phase Y. Remaining: [list remaining phases]."
   - Update `manage_todo_list` display derived from PROGRESS.json (see Display Derivation below)

⚠️ If PROGRESS.json is missing or corrupted, execute HALT Protocol and recreate from the last known state before proceeding.

### Display Derivation (manage_todo_list)

`manage_todo_list` is a **display-only projection** of PROGRESS.json. Never treat it as source of truth.

Map PROGRESS.json to the todo list:

```javascript
{ id: 1, title: "Phase 1: Research",       status: phases.research.status },
{ id: 2, title: "Phase 2: Specification",  status: phases.specification.status },
{ id: 3, title: "Phase 3a: Plan",          status: phases.plan.status },
{ id: 4, title: "Phase 3b: Tasks",         status: phases.tasks.status },
{ id: 5, title: "Phase 3c: Analyze",       status: phases.analyze.status },
{ id: 6, title: "Phase 4: Implement",      status: phases.implement.status },
{ id: 7, title: "Phase 5: Code Review",    status: phases.review.status },
// Dynamic fix tasks from PROGRESS.json fixTasks[] — IDs 100+
{ id: 8, title: "Phase 6: Validate",       status: phases.validate.status },
{ id: 9, title: "Phase 7: Document",       status: phases.document.status }
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

### HALT Protocol

When the workflow must stop, execute these steps consistently:

1. Set the current phase `status` to `"blocked"` in PROGRESS.json
2. Set `haltReason` to a description of what is needed to resume
3. Update `manage_todo_list` display (blocked phase shown as `"in-progress"`)
4. Report to user: what failed, why it's blocked, what's needed to continue

All "Execute HALT Protocol" references in this workflow invoke these 4 steps.

### Decision Presentation

When the workflow requires user input (post-phase failures, CONDITIONAL verdicts, triage decisions), present decisions consistently:

- Use `ask_questions` tool with one question per decision point
- Provide 2–3 concrete options (e.g., "Fix now", "Proceed anyway", "Halt workflow")
- Mark one option as `recommended` when the coordinator has a clear preference — omit when no option is clearly superior
- Include brief context: what failed, what impact each option has

---

## Quality Gates

### Pre-Review Gate (Pre-Review)

Before delegating to Code Review (Phase 5), the coordinator verifies ALL of the following:

| # | Check | How to verify |
|---|-------|---------------|
| 1 | Every FR-### in spec.md has corresponding implementation code | `grep_search` for each FR ID in source files |
| 2 | Every FR-### has at least one test covering it | `grep_search` for each FR ID in test files |
| 3 | `get_errors` returns 0 errors on modified files | Run `get_errors` |
| 4 | Test command passes with 0 failures | Run test command from Configuration |
| 5 | No TODO/FIXME markers remain in new code | `grep_search` for TODO\|FIXME in modified files |

**PASS**: All 5 checks pass → proceed to Code Review delegation
**FAIL**: Any check fails → create fix tasks, append to tasks.md and PROGRESS.json `fixTasks[]`, return to Phase 4. Increment `review.rubricAttempts` in PROGRESS.json.
**Max iterations**: 3 gate attempts. After 3 failures → execute HALT Protocol: "Pre-review gate failed 3 times — escalate to user"

Record results in PROGRESS.json `review.rubricScores` (pass/fail per check).

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
   - Check for `.specify/memory/constitution.md` — if it exists, note it as a governance dependency. Pass its path to plan and analyze delegations.
4. **External knowledge**: Use MCP tools from Configuration section when available. Skip unavailable tools.
5. **Clarify ambiguities**: For 2+ valid interpretations, ask ONE question with researched options

**Output**: Research summary — affected modules, existing patterns, prior specs, constraints, constitution path (if exists).

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
- Do NOT resolve [NEEDS CLARIFICATION] markers yourself — leave them in spec.md for the coordinator to triage
- Do NOT present handoff buttons or suggest delegating to other agents — return your results to the coordinator
- The specification defines WHAT, not HOW
WHEN DONE: Report: branch name, spec file path, spec number, section summary, checklist results.
```

Append Anti-Laziness Addendum.

### Coordinator Post-Delegation

1. Verify branch: `git branch --show-current` — execute HALT Protocol if not on feature branch
2. Verify spec file exists and contains complete specification
3. **Resolve clarifications**: Scan spec.md for `[NEEDS CLARIFICATION` markers
   - **If markers found**: Use the `ask_questions` tool to present each clarification to the user in a single call (batch up to 4 questions per call):
     - Extract the specific question text from inside each `[NEEDS CLARIFICATION: ...]` marker
     - Provide 2–3 suggested answers as options per question, derived from Phase 1 research context, domain conventions, or reasonable defaults
     - Mark one option as `recommended` when the coordinator is confident it is the best choice — omit `recommended` when no option is clearly superior
     - The `ask_questions` tool automatically shows a free-text "Other" option to users — do NOT add a custom/other option manually
     - After the user responds, replace each `[NEEDS CLARIFICATION: ...]` marker in spec.md with the resolved answer, written as a definitive statement (not a question)
     - Re-scan spec.md to confirm zero markers remain before proceeding
   - **If no markers found**: Proceed silently to the next step
4. **Create PROGRESS.json** in the spec directory (see State Management → Schema)
   - Mark `research` and `specification` as `"completed"` (retroactively)
   - Mark `plan` as `"in-progress"`
   - Populate `context` from Phase 1 research output

Execute Phase Transition Protocol.

---

## Phase 3: Planning

### Phase 3a: Implementation Plan

**Delegate to**: `speckit.plan` agent

#### Delegation Prompt

The plan agent defines its own phases, output files, and template workflow. The delegation provides instance context and lean anchors.

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: Generate implementation plan documents from the specification.
SCOPE:
- Feature directory: {spec directory}
REQUIREMENTS:
1. Generate plan artifacts (plan.md, research.md, data-model.md if applicable, quickstart.md)
ACCEPTANCE CRITERIA:
- [ ] plan.md exists with substantive content
- [ ] All documents are consistent with the specification
CONSTRAINTS:
- Your scope ends after plan artifact generation. Task breakdowns and implementation are separate phases handled by the coordinator.
- Do NOT present handoff buttons or suggest delegating to other agents — return your results to the coordinator.
WHEN DONE: Report: documents created, implementation approach summary, key technical decisions.
```

Append Anti-Laziness Addendum.

**Coordinator verifies**: plan.md exists in spec directory with substantive content. Scan for research.md, data-model.md — report which optional artifacts were generated vs. skipped so downstream agents know what's available.

Execute Phase Transition Protocol.

### Phase 3b: Task Generation

**Delegate to**: `speckit.tasks` agent

#### Delegation Prompt

The tasks agent defines its own checklist format, phase structure, and organization rules. The delegation provides instance context, lean anchors, and activates test generation.

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: Break the implementation plan into dependency-ordered tasks.
SCOPE:
- Feature directory: {spec directory}
REQUIREMENTS:
1. Generate tasks.md with dependency-ordered, executable tasks
2. Override your default: tests ARE mandatory for this delegation — generate test tasks before their corresponding implementation tasks (test-first)
3. If Configuration → Project Rules defines additional test requirements, apply them
ACCEPTANCE CRITERIA:
- [ ] tasks.md exists with proper checklist format and file paths
- [ ] Test tasks precede implementation tasks
- [ ] EVERY requirement above is fully implemented (no partial work)
CONSTRAINTS:
- Your scope ends after generating tasks.md. Implementation is a separate phase handled by the coordinator.
- Do NOT present handoff buttons or suggest delegating to other agents — return your results to the coordinator.
WHEN DONE: Report: task count, dependency summary, estimated complexity.
```

Append Anti-Laziness Addendum.

**Coordinator verifies**: tasks.md exists with proper task format (checkboxes, IDs, file paths).

Execute Phase Transition Protocol.

---

## Phase 3c: Cross-Artifact Analysis

**Delegate to**: `speckit.analyze` agent

**Purpose**: Catch inconsistencies, coverage gaps, and ambiguities across spec.md, plan.md, and tasks.md **before** the expensive implementation phase.

### Delegation Prompt

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: Analyze the feature artifacts for consistency and coverage issues.
SCOPE:
- Feature directory: {spec directory}
REQUIREMENTS:
1. Run detection passes across spec.md, plan.md, and tasks.md
2. Assign severity to every finding
3. Produce the coverage summary and metrics
ACCEPTANCE CRITERIA:
- [ ] Findings table with severity, location, and recommendation per finding
- [ ] Coverage summary maps requirements to tasks
- [ ] Metrics section complete (coverage %, issue counts)
CONSTRAINTS:
- Your scope ends after producing the analysis report with findings table, coverage summary, and metrics. The coordinator handles remediation triage and user interaction separately.
- Do NOT present handoff buttons or suggest delegating to other agents — return your results to the coordinator.
WHEN DONE: Report: findings table, coverage summary, metrics, and recommended next actions.
```

Append Anti-Laziness Addendum.

### Coordinator Post-Delegation: Triage Findings

The coordinator processes the analysis report in three passes:

#### Pass 1: Auto-resolve trivial findings

Findings that have exactly one obvious fix require no user input. Apply them directly:

- **Terminology drift**: Normalize to the canonical term used in spec.md
- **Wrong file paths in tasks.md**: Correct to match actual project structure
- **Unresolved placeholders** (TODO, TKTK, ???): Fill from spec/plan context if unambiguous
- **Task ordering errors**: Reorder in tasks.md to satisfy stated dependencies
- **Duplicate requirements**: Remove the lower-quality duplicate, keep the clearer version

After applying auto-fixes, report a summary of changes made (artifact, old value → new value) so the user can verify. If any auto-fix is uncertain, demote it to Pass 2 (user decision).

Record count in PROGRESS.json `analyze.autoResolved`.

#### Pass 2: Present decision-required findings to user

Findings with multiple valid resolutions require user input. Use `ask_questions` to present them:

- Batch up to 4 findings per `ask_questions` call
- For each finding, extract the core decision from the analysis recommendation
- Provide 2–3 resolution options derived from the analyze report's recommendations and the coordinator's Phase 1 research context
- Mark one option as `recommended` when the coordinator is confident — omit when no option is clearly superior
- The `ask_questions` tool automatically shows a free-text "Other" option — do NOT add one manually
- After user responds, apply the chosen resolution to the affected artifact(s) (spec.md, plan.md, or tasks.md)
- Record count in PROGRESS.json `analyze.userResolved`

**Examples of decision-required findings**:
- Conflicting requirements (e.g., spec says REST, plan says GraphQL) — user picks which
- Missing non-functional coverage — user decides if it should be added to tasks or deferred
- Ambiguous terms lacking measurable criteria — user provides the target metric

#### Pass 3: Gate implementation

After passes 1 and 2, evaluate remaining unresolved findings:

| Remaining findings | Action |
|--------------------|--------|
| 0 CRITICAL, 0 HIGH | Proceed to Phase 4 |
| 0 CRITICAL, 1+ HIGH | Report to user via Decision Presentation — user decides: fix or proceed |
| 1+ CRITICAL | Execute HALT Protocol — must resolve before implementation |

**If user chooses "fix" for HIGH findings**: Coordinator creates targeted fix tasks in the affected artifact(s) (spec.md, plan.md, or tasks.md), then re-runs Phase 3c analysis on affected artifacts only.

Record final severity counts in PROGRESS.json `analyze.findings`.

Execute Phase Transition Protocol.

---

## Phase 4: Implementation

**Delegate to**: `speckit.implement` agent

### Delegation Prompt

The implement agent defines its own phase execution, progress tracking, and validation flow. The delegation provides instance context, lean anchors, and overrides.

```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: Execute all tasks in the implementation plan.
SCOPE:
- Feature directory: {spec directory}
REQUIREMENTS:
1. Override your default: tests ARE mandatory for this delegation — write tests BEFORE implementation code (test-first)
2. If Configuration → Project Rules defines additional requirements, apply them
3. Use MCP tools for external library/API verification — do NOT rely on training data
4. If you cannot complete all tasks, begin your report with `STATUS: INCOMPLETE` followed by the blocking reason
ACCEPTANCE CRITERIA:
- [ ] All tasks in tasks.md marked [X]
- [ ] All tests pass and no lint/compile errors
- [ ] EVERY requirement above is fully implemented (no partial work)
CONSTRAINTS:
- Your scope ends after task execution. Code review, validation, and documentation are separate phases handled by the coordinator.
- Do NOT present handoff buttons or suggest delegating to other agents — return your results to the coordinator.
WHEN DONE: Report: files created/modified, test results summary, task completion status, issues encountered.
```

Append Anti-Laziness Addendum.

**TDD Agent Alternative**: If Configuration → Project Rules specifies "test-first development" (TDD), delegate the test-first cycle to TDD agents instead of speckit.implement:
1. `TDD Red Phase` — write failing tests from task requirements
2. `TDD Green Phase` — implement minimal code to pass tests
3. `TDD Refactor Phase` — improve quality while maintaining green tests

Otherwise, use speckit.implement with the test-first requirements above.

### Coordinator Post-Delegation

1. Verify all tasks in tasks.md are marked complete (`[X]`)
2. **Check for INCOMPLETE status**: If implement agent returned `STATUS: INCOMPLETE`, present the blocking reason to user via Decision Presentation. Options: re-delegate with guidance, fix manually, halt workflow.
3. **Run Post-Phase Validation**: Run tests + `get_errors` on modified files
4. Read PROGRESS.json — verify phases review/validate/document are still `"not-started"`

Execute Phase Transition Protocol.

---

## Phase 5: Code Review

### Pre-Review Self-Check

1. Run **Pre-Review Gate** (see Quality Gates)
2. If any check fails: create fix tasks, append to tasks.md and PROGRESS.json `fixTasks[]`, increment `review.rubricAttempts`, return to Phase 4
3. If all checks pass: proceed to delegation

### Pre-Review Error Check

Run `get_errors` on all modified files BEFORE delegating. Include findings in the delegation prompt as a numbered REQUIREMENTS item — the review agent cannot access IDE diagnostics.

**Pre-existing errors from `get_errors`**: Include verbatim in the delegation under a `PRE-EXISTING ERRORS` section after SCOPE.

### Delegate to Code Review Agent

**Optional: Security Review** — If the feature's `complexityScore ≥ 8` OR the feature touches security-sensitive areas (authentication, file I/O, network, user input), additionally delegate to a security-focused review agent. Security findings feed into the same verdict flow.

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
2. **If attempt ≤ 2**:
   - Create fix tasks from review findings (one task per critical/high issue)
   - Append fix tasks to **both** `tasks.md` (so `speckit.implement` can see them) and PROGRESS.json `fixTasks[]` (for tracking)
   - Return to Phase 4 with delegation scoped to fix tasks only
3. **If attempt > 2**: Execute HALT Protocol — escalate to user with full analysis across all attempts. Options: manual fix, reduce scope, accept as-is, abandon review.

Execute Phase Transition Protocol after APPROVED or CONDITIONAL-accepted.

---

## Phase 6: Validate

**Coordinator executes directly.** MANDATORY — do not skip even if code review passed.

**Purpose**: Phase 6 is a final integration gate — it catches issues that file-by-file review misses, including regressions introduced during review fix cycles.

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

1. **Spec updates**: Compare implementation against spec.md. For intentional scope changes approved during Phase 3c/4, update spec.md to reflect the approved change. For unintentional drift, create a follow-up task to align implementation with spec.
2. **Architecture docs**: If new components, patterns, or integrations were added:
   - Update relevant architecture documentation (if it exists)
   - If a significant architectural decision was made, delegate to `ADR Generator`
3. **User-facing docs**: If the feature changes user-visible behavior:
   - Delegate to `SE: Tech Writer` for documentation updates
   - Include usage examples
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
- [ ] Analysis findings resolved (0 critical/high remaining)
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
| PROGRESS.json missing/corrupted | Execute HALT Protocol — recreate from last known state |
| Subagent returns incomplete output | Verify file(s) exist. If `STATUS: INCOMPLETE`, present blocking reason via Decision Presentation. Otherwise use partial output, note gaps, ask user |
| Test failures in Phase 4 | Normal TDD — fix in implementation. Not a workflow error |
| Rubric fail (attempt ≤ 3) | Create fix tasks in tasks.md + PROGRESS.json `fixTasks[]`, return to Phase 4 |
| Rubric fail (attempt > 3) | Execute HALT Protocol — escalate to user |
| Code review REJECTED (attempt ≤ 2) | Add fix tasks to tasks.md + PROGRESS.json `fixTasks[]`, return to Phase 4 |
| Code review REJECTED (attempt > 2) | Execute HALT Protocol — escalate to user with full analysis |
| Post-phase validation fails | Report failures via Decision Presentation. User decides next step |
| Analyze finds CRITICAL issues | Execute HALT Protocol — resolve before Phase 4. Auto-fix trivials, ask user for decisions |
| Branch not on feature branch | Execute HALT Protocol — resolve git state before continuing |
| MCP tool unavailable | Use fallback from Configuration table. Note limitation to user |
| Total Phase 4 executions > 4 | Execute HALT Protocol — max 4 total Phase 4 delegations (gate + review combined) |
