# Specification-Driven Development Workflow

**Purpose**: Coordinator orchestrates SpecKit subagents for specification-driven feature development.

**Pattern**: Coordinator → Subagent → Results → Coordinator → Next Subagent. Subagents NEVER call other subagents.

**When to use**: New capabilities requiring database schema changes, new UI components, architecture decisions, or 4+ files modified.

**When NOT to use**: Bug fixes, refactors, documentation, routine multi-file changes (2-3 files).

---

## Hard Rules

- NEVER proceed to Phase 2 without completing coordinator research (Phase 1b)
- NEVER delegate without providing USER REQUEST, spec number, branch, and working directory
- NEVER skip Phase 5 (Code Review) — even for "simple" features
- All subagents inherit `copilot-instructions.md` rules (Pre-Work Checklist, Hard Rules, MCP Tools §4)

---

## Phase 0: Routing & Prerequisites

Confirm qualification. **Exit to `workon.myidea.prompt.md`** if: bug fix only, documentation only, fewer than 4 files affected, or unclear scope needing user clarification.

**User Confirmation**: Confirm user wants full specification workflow before proceeding.

### Todo List Template

Every `manage_todo_list` update MUST include ALL 9 phases. Dynamic tasks use ids 100+.

```javascript
{ id: 1, title: "Phase 0: Routing", status: "..." },
{ id: 2, title: "Phase 1: Branch + Research", status: "..." },
{ id: 3, title: "Phase 2: Specification", status: "..." },
{ id: 4, title: "Phase 3a: Implementation Plan", status: "..." },
{ id: 5, title: "Phase 3b: Task Generation", status: "..." },
{ id: 6, title: "Phase 4: Implementation", status: "..." },
{ id: 7, title: "Phase 5: Code Review", status: "..." },
// Dynamic tasks (id 100+) inserted here
{ id: 8, title: "Phase 6: Validate", status: "..." },
{ id: 9, title: "Phase 7: Document", status: "..." }
```

❌ **NEVER** write a list missing phases 8-9

---

## Phase 1: Branch Setup + Coordinator Research

**Coordinator executes directly** (DO NOT delegate).

### 1a. Branch Setup

1. `git branch --show-current` + `get_changed_files` — check state
2. If uncommitted changes: `git add -A && git commit -m "chore: WIP before spec {N}"`
3. `git checkout main`
4. `list_dir` on `specs/` → find highest number → increment
5. Create slug from user request (2-4 keywords, kebab-case)
6. `git checkout -b {spec-number}-{feature-slug}`
7. Verify: `git branch --show-current` — **HALT if wrong branch**

### 1b. Coordinator Research (MANDATORY before delegation)

**Purpose**: Feed context to the specification subagent so it doesn't work blind.

Execute Pre-Work Checklist steps 1-3 from `copilot-instructions.md`:
1. **CLASSIFY**: "This is a Large Feature affecting [component]."
2. **SCOPE**: Identify affected files/modules via `grep_search` or `semantic_search`
3. **RESEARCH**: Read existing patterns in affected modules. Check `specs/` for related prior work. Check `docs/adr/` for architectural constraints. Read `docs/NAVIGATION-GUIDE.md` for component routing.

**MCP tools are MANDATORY for external knowledge:**
- PowerShell/.NET → `mcp_microsoftdocs_microsoft_docs_search`
- Libraries/frameworks → `mcp_context7_resolve-library-id` → `mcp_context7_get-library-docs`
- Current versions → `mcp_brave-search_brave_web_search`
- Architecture decisions → `mcp_sequential-th_sequentialthinking`

**Output**: Capture research findings as context for the delegation prompt in Phase 2.

Report to user: Spec number, branch name, research summary. Mark Phase 1 complete.

---

## Phase 2: Specification

**Delegate to**: `speckit.specify` agent

**Delegation prompt MUST include**:
- USER REQUEST (original)
- Spec number, branch, working directory
- Research context from Phase 1b (affected modules, existing patterns, prior specs)
- Task: Create `specs/{N}-{slug}/spec.md` with user stories, requirements, success criteria

**Coordinator verifies**: `spec.md` exists and contains complete specification.

---

## Phase 3: Planning

### Phase 3a: Implementation Plan

**Delegate to**: `speckit.plan` agent

**Delegation prompt MUST include**:
- USER REQUEST, spec file path, working directory
- Task: Generate plan.md, research.md, data-model.md (if needed), quickstart.md

**Coordinator verifies**: `plan.md` exists.

### Phase 3b: Task Generation

**Delegate to**: `speckit.tasks` agent

**Delegation prompt MUST include**:
- USER REQUEST, feature directory, available design docs
- PROJECT OVERRIDE: Tests are MANDATORY per Constitution Principle XI — generate test tasks for ALL user stories

**Coordinator verifies**: `tasks.md` exists with proper task format.

---

## Phase 4: Implementation

**Delegate to**: `speckit.implement` agent

**Delegation prompt MUST include**:
- USER REQUEST, tasks file path, design docs
- PROJECT OVERRIDES:
  - Test-First Development (Principle XI — MANDATORY)
  - RED-GREEN-REFACTOR cycle (MANDATORY)
  - Tests MUST be written BEFORE implementation code
- **MCP MANDATE**: MUST use Context7 for external library docs, microsoft_docs_search for PowerShell/.NET patterns, brave_web_search for current versions. Do NOT rely on training data for API signatures or version numbers.

**Coordinator verifies**: All tasks complete, all tests passing, no lint errors.

---

## Phase 5: Code Review

**Delegate to**: `code-review` agent

**Delegation prompt MUST include**:
- Spec file path, branch name
- Review scope: Constitutional compliance, spec compliance, test coverage, security
- Critical checks: RED-GREEN-REFACTOR followed? YAGNI violations? Silent failures?

**Coordinator Decision**:
- **APPROVED** (0 critical/high): Proceed to Phase 6
- **CONDITIONAL** (1-3 issues): Ask user to accept or revise
- **REJECTED** (4+): Insert fix tasks (IDs 100+), PRESERVE phases 8-9, return to Phase 4

---

## Phase 6: Validate

**Coordinator executes directly**:
1. `Invoke-Build Test` (NEVER `-Output Detailed`)
2. `get_errors` on modified files
3. Cross-reference spec.md Success Criteria

Report: Test results, error count, criteria met/unmet.

---

## Phase 7: Document

**Coordinator executes directly**:
1. Update architecture docs if components changed
2. Update spec.md if requirements adjusted
3. Update user docs if user-facing changes
4. Create ADR if architectural decision made

---

## Completion Checklist

- [ ] spec.md, plan.md, tasks.md created
- [ ] All tasks completed, all tests passing
- [ ] Code review APPROVED/CONDITIONAL (accepted)
- [ ] No errors, spec criteria met
- [ ] Documentation updated

**Final Report**: Spec number, branch, implementation summary, test results, next steps (merge/PR).

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Subagent incomplete output | Use partial output, note gaps, ask user |
| Test failures (Phase 4) | Normal TDD — fix in GREEN step |
| Code review REJECTED | Insert fix tasks (IDs 100+), PRESERVE phases 8-9 |
| Branch creation fails | HALT — resolve git issue first |
| Todo list update | ALWAYS include ALL 9 phases plus dynamic tasks (100+) |
