---
agent: "agent"
description: "Coordinator for specification-driven template development in workspace-baseline using SpecKit subagents."
---

# Specification-Driven Development Workflow

**Purpose**: Coordinator orchestrates SpecKit subagents for specification-driven feature development in the workspace-baseline template library.

**Pattern**: Coordinator → Subagent → Results → Coordinator → Next Subagent. Subagents NEVER call other subagents.

**When to use**: New template categories, structural reorganization, new SpecKit features, new skill bundles, cross-cutting convention changes, or 4+ files modified.

**When NOT to use**: Single-file template edits, typo fixes, frontmatter corrections, README table updates, or routine 2-3 file changes.

**Prerequisites**: SpecKit framework installed (`.specify/` directory with templates and scripts).

---

## Workspace Context

This repository is a **template library**, not an application. All "features" are MD file templates, scripts, or documentation. There is no compiled code, no application test suite, and no deployment pipeline.

### Key Constraints (from copilot-instructions.md)

- **OS**: Windows + WSL
- **No local Python/Node** — use Docker isolation for Python and Node.js tooling
- **Root is authoritative** — all templates originate in root folders (`instructions/`, `agents/`, `prompts/`, `skills/`); `.github/` draws from root
- **Frontmatter conventions**: Instructions require `description` + `applyTo`; Agents require `description` + `name`
- **README.md sync**: Adding/removing/renaming templates MUST update the corresponding `What's Inside` table in root README.md
- **ADRs for significant decisions**: Structural changes, new conventions, philosophy shifts go in `docs/adr/`
- **MCP tools are mandatory** for external knowledge — never guess API signatures or version numbers

### Agents (SpecKit — required)

| Role | Agent | Purpose |
|------|-------|---------|
| Specification | `speckit.specify` | Creates spec + branch via `.specify/` scripts |
| Planning | `speckit.plan` | Generates design artifacts (plan.md, research.md, data-model.md) |
| Task Generation | `speckit.tasks` | Breaks plan into dependency-ordered tasks |
| Implementation | `speckit.implement` | Executes task plan phase-by-phase |
| Code Review | `code-review` | Fresh-context validation and compliance check |

> Note: The `code-review` agent is in the root `agents/` folder. Only `critical-thinking` and `prompt-builder` are active in `.github/agents/`.

### Test & Validation

This workspace has **no test runner**. Validation is structural, not executable.

| Action | Method | Notes |
|--------|--------|-------|
| Frontmatter check | Manual inspection or `grep_search` | Verify `description`, `applyTo`/`name` fields |
| File existence | `file_search` / `list_dir` | Confirm templates were created in correct locations |
| README sync | Read `README.md` tables | Verify new entries match actual files |
| Lint/compile check | `get_errors` tool | Check for markdown syntax issues |
| Link validation | `grep_search` for broken refs | Verify cross-references between docs |

### Project Paths

| Path | Purpose |
|------|---------|
| `instructions/` | Root authoritative instruction templates |
| `agents/` | Root authoritative agent definitions |
| `prompts/` | Root authoritative prompt files |
| `skills/` | Root authoritative skill bundles |
| `.github/` | Downstream workspace-active copies |
| `specs/` | Feature specifications (created on first use) |
| `docs/adr/` | Architecture Decision Records |
| `docs/architecture/` | Design patterns and structure |
| `docs/development/` | Workflows and iteration logs |
| `docs/prompt-craft/` | Prompt experiments and lessons learned |
| `.specify/` | SpecKit framework (templates + scripts) |

### MCP Tools (all configured in this workspace)

| Need | Tool |
|------|------|
| PowerShell/.NET docs | `mcp_microsoftdocs_microsoft_docs_search` |
| Library/framework docs | `mcp_context7_resolve-library-id` → `mcp_context7_get-library-docs` |
| Current versions/APIs | `mcp_brave-search_brave_web_search` |
| Discover community MD files | `mcp_awesome-copil_search_instructions` / `mcp_awesome-copil_search_agents` |
| Complex reasoning | `mcp_sequential-th_sequentialthinking` (min 3 thoughts) |

> **Rule**: Never guess API signatures or version numbers. Use MCP tools — they are all available in this workspace.

### Workspace-Specific Rules

- **Root is authoritative**: New templates MUST be created in root folders first, then optionally copied to `.github/`
- **Template quality checklist**: No project-specific references, code examples match target tech stack, MCP tool references correct
- **Naming conventions**: `{technology}.instructions.md`, `{purpose}.agent.md`, `{workflow}.prompt.md`, `{name}/SKILL.md`
- **README.md sync is mandatory**: Every template add/remove/rename must update the corresponding table
- **ADR required for**: New conventions, philosophy changes, technology additions, structural reorganization

---

## Hard Rules

- NEVER proceed to Phase 2 without completing coordinator research (Phase 1)
- NEVER delegate without providing USER REQUEST, research context, and working directory
- NEVER skip Phase 5 (Code Review) — even for "simple" features
- NEVER write a todo list update missing IDs 7-8 (Validate and Document)
- NEVER create templates directly in `.github/` — root folders are authoritative
- ALWAYS read PROGRESS.md before each phase transition (after Phase 2 creates it)
- ALWAYS execute the Phase Transition Protocol between phases
- ALWAYS verify README.md sync after adding/removing templates

---

## Phase 0: Routing (Pre-Tracking Gate)

This phase completes BEFORE todo list initialization.

1. Confirm qualification: structural scope, file count, cross-cutting impact
2. **Exit to `workon.myidea.prompt.md`** if: single template edit, typo fix, frontmatter correction, README update, or fewer than 4 files
3. Confirm user wants full specification workflow before proceeding
4. Initialize todo list with ALL 8 phases (see template below)

### Todo List Template

Every `manage_todo_list` call MUST include ALL 8 items. Dynamic tasks use IDs 100+.

```javascript
{ id: 1, title: "Phase 1: Research", status: "..." },
{ id: 2, title: "Phase 2: Specification", status: "..." },
{ id: 3, title: "Phase 3a: Plan", status: "..." },
{ id: 4, title: "Phase 3b: Tasks", status: "..." },
{ id: 5, title: "Phase 4: Implement", status: "..." },
{ id: 6, title: "Phase 5: Code Review", status: "..." },
// Dynamic fix tasks (id 100+) inserted here
{ id: 7, title: "Phase 6: Validate", status: "..." },
{ id: 8, title: "Phase 7: Document", status: "..." }
```

❌ **NEVER** write a todo list missing IDs 7-8 (Validate and Document)
✅ **VERIFY** before every `manage_todo_list` call: "Do IDs 7 and 8 exist in my update?"

---

## Phase Transition Protocol

**Before EVERY phase transition**, the coordinator MUST:

1. **Read** PROGRESS.md from the spec directory (after Phase 2 creates it)
2. **Verify** all remaining phases are tracked in both todo list and PROGRESS.md
3. **Update** both artifacts:
   - Mark current phase ✅ complete in PROGRESS.md
   - Mark next phase 🔄 in-progress
   - Confirm remaining phases exist and are ⬜ not-started
4. **Report** to user: "Phase X complete → Phase Y. Remaining: [list remaining phases]"

⚠️ If PROGRESS.md is missing or corrupted, HALT and recreate it from the todo list before proceeding.

---

## Phase 1: Coordinator Research

**Coordinator executes directly** (DO NOT delegate).

### Research Steps

1. **CLASSIFY**: "This is a [template category/structural change] affecting [which root folders]."
2. **SCOPE**: Identify affected folders and templates via `grep_search` or `semantic_search`
3. **RESEARCH**:
   - Read existing templates in the same category for pattern consistency
   - Check `specs/` for related prior specifications (if directory exists)
   - Check `docs/adr/` for relevant architectural decisions
   - Read `docs/architecture/README.md` for structural patterns
   - Review naming conventions in `copilot-instructions.md`
   - Search community examples: `mcp_awesome-copil_search_instructions` or `mcp_awesome-copil_search_agents`
4. **External knowledge**: Use MCP tools for technology-specific research (all tools are configured in this workspace).

**Output**: Research summary capturing: affected folders, existing template patterns, naming conventions, prior specs, ADR constraints.

Report to user: research summary. Mark Phase 1 complete.

---

## Phase 2: Specification

**Delegate to**: `speckit.specify` agent

The specify agent owns branch creation and spec file generation via `.specify/` scripts. The coordinator does NOT create a branch — the specify agent handles this.

**Delegation prompt MUST include**:
- USER REQUEST (original, verbatim)
- Research context from Phase 1 (affected folders, existing patterns, naming conventions)
- Working directory
- Note: This is a template library project — "implementation" means creating/modifying MD files, not application code

**Expected return from agent**:
- Branch name created
- Spec file path
- Spec number
- Checklist results (if validation was run)

**Coordinator post-delegation**:
1. Verify branch: `git branch --show-current` — HALT if not on feature branch
2. Verify spec file exists and contains complete specification
3. **Create PROGRESS.md** in the spec directory with this format:

```markdown
# Progress: {feature-name}

Branch: {branch-name}
Spec: {spec-file-path}

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Research | ✅ | [research summary headline] |
| 2. Specification | ✅ | spec.md created |
| 3a. Plan | ⬜ | |
| 3b. Tasks | ⬜ | |
| 4. Implement | ⬜ | |
| 5. Code Review | ⬜ | Attempts: 0/2 |
| 6. Validate | ⬜ | |
| 7. Document | ⬜ | |
```

4. Execute Phase Transition Protocol. Mark Phase 2 complete.

---

## Phase 3: Planning

### Phase 3a: Implementation Plan

**Delegate to**: `speckit.plan` agent

**Delegation prompt MUST include**:
- USER REQUEST, spec file path, working directory
- Note: "Implementation" in this project means authoring MD templates and documentation — plan accordingly
- Task: Generate plan.md, research.md, and quickstart.md (data-model.md unlikely needed for a template library)

**Coordinator verifies**: plan.md exists in spec directory.

Execute Phase Transition Protocol. Mark Phase 3a complete.

### Phase 3b: Task Generation

**Delegate to**: `speckit.tasks` agent

**Delegation prompt MUST include**:
- USER REQUEST, feature directory path, list of available design docs
- **Workspace-specific task requirements**:
  - Every new template MUST be created in the root authoritative folder first
  - A corresponding task for `.github/` copy if the template is workspace-active
  - A README.md sync task for any template add/remove/rename
  - An ADR task if the work introduces new conventions or structural changes
  - Frontmatter validation task for every new template file

**Coordinator verifies**: tasks.md exists with proper task format (checkboxes, IDs, file paths).

Execute Phase Transition Protocol. Mark Phase 3b complete.

---

## Phase 4: Implementation

**Delegate to**: `speckit.implement` agent

**Delegation prompt MUST include**:
- USER REQUEST, tasks file path, design doc paths
- **Workspace-specific rules**:
  - Root folders are authoritative — create templates there first
  - Follow naming conventions: `{technology}.instructions.md`, `{purpose}.agent.md`, etc.
  - Frontmatter must include required fields (`description` + `applyTo` for instructions, `description` + `name` for agents)
  - No project-specific references in root templates (they must be portable)
  - `.github/` copies may include workspace-specific customizations
- ⚠️ **Context anchor**: "After implementation, the coordinator proceeds to Phase 5 (Code Review), Phase 6 (Validate), and Phase 7 (Document). The implement agent does NOT manage these phases."
- **MCP mandate**: Use MCP tools for external knowledge. Do NOT rely on training data for API signatures or version numbers.

**Coordinator post-delegation**:
1. Verify all tasks in tasks.md are marked complete (`[X]`)
2. Run `get_errors` on modified files — report any issues
3. **Read PROGRESS.md** — verify phases 5-7 are still tracked as ⬜ not-started

Execute Phase Transition Protocol. Mark Phase 4 complete.

---

## Phase 5: Code Review

**Delegate to**: `code-review` agent

**Attempts tracked**: PROGRESS.md records review iteration count. Maximum 2 attempts before escalation.

**Delegation prompt MUST include**:
- Spec file path, branch name
- Review scope: spec compliance, template quality, naming conventions, frontmatter correctness, README sync
- Changed files summary (from `get_changed_files`)
- **Workspace-specific checks**:
  - Root templates have no project-specific references (portable)
  - `.github/` copies are appropriately customized
  - Naming conventions followed
  - Frontmatter includes required fields
  - README.md tables updated for any template changes
  - ADR created if needed

**Coordinator Decision**:

| Verdict | Criteria | Action |
|---------|----------|--------|
| **APPROVED** | 0 critical/high issues | Proceed to Phase 6 |
| **CONDITIONAL** | 1-3 critical/high issues | Ask user: accept as-is or fix? |
| **REJECTED** | 4+ critical/high issues | See Rejection Handling below |

### Rejection Handling

1. Increment review attempt counter in PROGRESS.md
2. **If attempt ≤ 2**:
   - Insert fix tasks (IDs 100+) into todo list
   - **PRESERVE IDs 7-8** (Validate and Document) — verify they exist before submitting the update
   - Return to Phase 4 with fix tasks only (do not re-run all implementation tasks)
3. **If attempt > 2**: **HALT and escalate to user**:
   - Report: all findings across all iterations
   - Options: manual fix, reduce scope, accept as-is, abandon review
   - Do NOT loop again without explicit user direction

Execute Phase Transition Protocol after APPROVED or CONDITIONAL-accepted. Mark Phase 5 complete.

---

## Phase 6: Validate

**Coordinator executes directly.** This phase is MANDATORY — do not skip even if code review passed.

### Validation Steps (Template Library — no test runner)

1. **Frontmatter audit**: For every new/modified template file, verify:
   - Instructions: `description` and `applyTo` fields present
   - Agents: `description` and `name` fields present
   - Prompts: `description` field present; `agent` field if applicable
   - Skills: `name` and `description` fields present
2. **File placement**: Verify authoritative versions exist in root folders, `.github/` copies where needed
3. **Naming conventions**: Verify filenames match patterns (`{technology}.instructions.md`, etc.)
4. **README.md sync**: Read README.md `What's Inside` tables and verify all new/changed templates are listed
5. **Cross-references**: `grep_search` for any broken links or references to renamed/removed files
6. **Lint check**: Run `get_errors` on all modified files for markdown syntax issues
7. **Spec compliance**: Read spec.md Success Criteria and cross-reference against implementation
   - For each criterion: ✅ Met | ❌ Not met | ⚠️ Partially met

### Validation Report

Report to user in this format:

```
Validation Results:
- Frontmatter: [PASS/FAIL] — [details of any issues]
- File Placement: [PASS/FAIL] — [root vs .github/ audit]
- Naming: [PASS/FAIL] — [convention compliance]
- README Sync: [PASS/FAIL] — [tables match files]
- Cross-references: [PASS/FAIL] — [broken links found]
- Lint: [count] issues remaining
- Spec Criteria: [N/M] success criteria met
- Overall: [PASS/FAIL]
```

If validation fails, report specific failures. User decides whether to fix or proceed.

Execute Phase Transition Protocol. Mark Phase 6 complete.

---

## Phase 7: Document

**Coordinator executes directly.** This phase is MANDATORY — do not skip even for "internal" changes.

### Documentation Steps

1. **Spec updates**: If any requirements changed during implementation, update spec.md to reflect actuals
2. **README.md**: Final verification that `What's Inside` tables, `Tech Stack Coverage`, and `Docs` sections are current
3. **Architecture docs**: If structural patterns changed, update `docs/architecture/README.md`
4. **ADR**: Create in `docs/adr/` if this work introduced:
   - New conventions or naming patterns
   - Philosophy changes (e.g., how templates are organized or authored)
   - Technology additions to the library
   - Structural reorganization
5. **Development docs**: If workflows changed, update `docs/development/README.md`
6. **Prompt craft docs**: If prompt techniques were refined, update `docs/prompt-craft/README.md`
7. **PROGRESS.md**: Mark all phases complete, add final summary

### Documentation Report

```
Documentation Updates:
- README.md: [updated/no change]
- ADR created: [yes/no — title if yes]
- Architecture docs: [updated/no change]
- Development docs: [updated/no change]
- Other files: [list or "none"]
```

Mark Phase 7 complete.

---

## Completion Checklist

- [ ] spec.md, plan.md, tasks.md created in spec directory
- [ ] All tasks completed
- [ ] Code review APPROVED or CONDITIONAL (accepted by user)
- [ ] No lint/syntax errors
- [ ] Frontmatter valid on all new/modified templates
- [ ] Templates in root authoritative folders (with `.github/` copies where needed)
- [ ] README.md tables synchronized with actual files
- [ ] ADR created if conventions/structure changed
- [ ] Spec success criteria validated
- [ ] PROGRESS.md shows all phases ✅

**Final Report**: Spec number, branch, templates created/modified, README sync status, ADR status, next steps (merge/PR).

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Subagent returns incomplete output | Verify file(s) exist. Use partial output, note gaps, ask user |
| Code review REJECTED (attempt ≤ 2) | Insert fix tasks (IDs 100+), **PRESERVE IDs 7-8**, return to Phase 4 |
| Code review REJECTED (attempt > 2) | **HALT** — escalate to user with full analysis |
| PROGRESS.md missing or corrupted | Recreate from todo list state before continuing |
| Branch not on feature branch | HALT — resolve git state before continuing |
| Template in wrong folder | Move to root authoritative folder, update `.github/` copy |
| README.md out of sync | Add to fix tasks — must be resolved before merge |
| Todo list update | **ALWAYS** include ALL 8 items (IDs 1-8) plus dynamic tasks (100+) |
