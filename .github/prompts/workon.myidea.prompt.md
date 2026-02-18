---
agent: "agent"
description: "Structured workflow for template edits, small improvements, and refactors in workspace-baseline. Routes large features to workon.spec.prompt.md."
---

## Objective

[State what you want to accomplish in 1-2 sentences]

---

## Workspace Context

This repository is a **template library** of reusable Copilot MD files, not an application. All "code" is markdown templates, PowerShell scripts (`.specify/`), and documentation.

### Key Constraints

- **OS**: Windows + WSL
- **No local Python/Node** — Docker isolation only
- **Root is authoritative**: Templates originate in `instructions/`, `agents/`, `prompts/`, `skills/`; `.github/` draws from root
- **Frontmatter**: Instructions need `description` + `applyTo`; Agents need `description` + `name`
- **README.md sync**: Template changes MUST update the matching `What's Inside` table
- **ADRs**: Significant decisions go in `docs/adr/`
- **Naming**: `{technology}.instructions.md`, `{purpose}.agent.md`, `{workflow}.prompt.md`, `{name}/SKILL.md`

### Validation (no test runner)

| Check | Method |
|-------|--------|
| Frontmatter | `grep_search` for required fields |
| File placement | `list_dir` / `file_search` |
| README sync | Read README.md tables |
| Lint | `get_errors` on modified files |

### MCP Tools (all configured)

| Need | Tool |
|------|------|
| PowerShell/.NET docs | `mcp_microsoftdocs_microsoft_docs_search` |
| Library/framework docs | `mcp_context7_resolve-library-id` → `mcp_context7_get-library-docs` |
| Current versions/APIs | `mcp_brave-search_brave_web_search` |
| Community MD files | `mcp_awesome-copil_search_instructions` / `mcp_awesome-copil_search_agents` |
| Complex reasoning | `mcp_sequential-th_sequentialthinking` (min 3 thoughts) |

> **Rule**: Never guess API signatures or version numbers. Use MCP tools — they are all available.

---

## Phase 0: Work Classification

**Determine if request qualifies for specification-driven workflow.**

### Qualification Criteria (Routes to Spec if ANY):

- New template category requiring multiple new files
- Structural reorganization (moving/renaming folders, changing conventions)
- New SpecKit features or workflow changes
- New skill bundles with scripts/assets
- Cross-cutting changes affecting 4+ files

### Decision Point

**If YES (spec-worthy)**:
1. Check `specs/` directory for existing specification using `file_search`
2. If spec exists: Note spec number, proceed to Phase 1 (use spec as contract)
3. If NO spec exists: **HAND OFF TO USER**:
   - Report: "This work requires specification-driven workflow"
   - Instruct: "Please reinvoke with `workon.spec.prompt.md` to create specification"
   - **EXIT this prompt** (user chooses spec workflow)

**If NO (non-spec work)** — examples:
- Single template creation/edit
- Frontmatter fixes across a few files
- README.md table updates
- Documentation improvements
- Typo corrections, formatting cleanup

Action:
- Document justification for skipping spec
- Initialize progress tracking with ALL 6 phases (see template below)
- Continue to Phase 1 (Research & Context)

---

## Todo List Management

**CRITICAL**: `manage_todo_list` replaces the entire list on every call. This is the primary cause of phase loss.

### Rules

1. Every update MUST include ALL 6 phases (IDs 1-6) — no exceptions
2. Dynamic fix tasks use IDs 100+ (inserted between ID 4 and ID 5)
3. **NEVER** omit not-started phases — even when adding dynamic tasks
4. **Self-check**: Before every `manage_todo_list` call, verify: "Are IDs 5 and 6 present in my update?"

### Template (always include all 6):

```javascript
{ id: 1, title: "Phase 1: Research & Context", status: "..." },
{ id: 2, title: "Phase 2: Plan & Track", status: "..." },
{ id: 3, title: "Phase 3: Implement", status: "..." },
{ id: 4, title: "Phase 4: Code Review", status: "..." },
// Dynamic fix tasks (id 100+) inserted here when needed
{ id: 5, title: "Phase 5: Validate", status: "..." },
{ id: 6, title: "Phase 6: Document", status: "..." }
```

❌ **NEVER** write a list missing IDs 5-6 (Validate and Document)
✅ **VERIFY** before every `manage_todo_list` call: "Do IDs 5 and 6 exist in my update?"

### Phase Transition Check

Before moving to the next phase:
1. Verify IDs 5 and 6 exist in the current todo list
2. Mark current phase completed
3. Mark next phase in-progress
4. Report to user: "Phase X complete → Phase Y. Remaining: [list remaining phases]"

---

## Phase 1: Research & Context

**This phase is MANDATORY.** Research before implementing.

- **Classify**: What kind of change? (new template, edit existing, restructure, docs update)
- **Scope**: Identify affected files and folders via `grep_search` or `semantic_search`
- **Research**:
  - Read existing templates in the same category for pattern consistency
  - Check naming conventions in `copilot-instructions.md`
  - Review README.md tables to understand current catalog state
  - For new technology templates: use MCP tools to research current best practices
  - For community patterns: `mcp_awesome-copil_search_instructions` or `mcp_awesome-copil_search_agents`
- **Clarify ambiguities**: For 2+ valid interpretations, ask ONE question with researched options

## Phase 2: Plan & Track

- Use `manage_todo_list` to add discrete implementation tasks (IDs 100+)
- Identify target files and their correct root folder locations
- Plan `.github/` copy tasks if templates need workspace-active versions
- Plan README.md sync task if adding/removing/renaming templates
- Plan ADR task if introducing new conventions
- ⚠️ When adding implementation tasks, include ALL 6 phases (IDs 1-6) in the update

## Phase 3: Implement

- Create templates in **root authoritative folders** first
- Copy to `.github/` and customize if needed for this workspace
- Follow naming conventions and frontmatter requirements
- Mark implementation tasks (IDs 100+) complete as you progress
- **Verify file writes**: Confirm files exist in correct locations after creation
- ⚠️ **Before marking Phase 3 complete**: Run Phase Transition Check. Verify IDs 5-6 still exist.

## Phase 4: Code Review

**Delegate to Code Review Agent**: Fresh-context validation.

**Attempts tracked**: Maximum 2 review iterations before escalation.

**Agent validates**:
- Template quality: portable (no project-specific refs in root), properly named, frontmatter correct
- Pattern compliance: consistent with existing templates in same category
- README sync: tables updated for any template changes
- ADR: created if conventions changed

**Agent returns**:

| Verdict | Action |
|---------|--------|
| **APPROVED** (0 critical/high) | Proceed to Phase 5 |
| **CONDITIONAL** (1-3 issues) | User decides: accept or revise |
| **REJECTED** (4+ issues) | See rejection handling below |

### Rejection Handling

1. Increment review attempt counter
2. **If attempt ≤ 2**: Insert fix tasks (IDs 100+). **PRESERVE IDs 5-6**. Return to Phase 3 with fix tasks only.
3. **If attempt > 2**: **HALT and escalate to user** with full analysis across all attempts.

### Todo List Update After Rejection

The updated list MUST include:
- IDs 1-4 (existing phases, with 3 reset to in-progress)
- IDs 100+ (new fix tasks)
- IDs 5-6 (Validate and Document — **NEVER** remove these)

⚠️ Verify IDs 5 and 6 are present before submitting the update.

## Phase 5: Validate

**This phase is MANDATORY** — do not skip, do not merge with Phase 4.

### Validation Steps (Template Library)

1. **Frontmatter audit**: For every new/modified template, verify required fields are present and correctly formatted
2. **File placement**: Authoritative version exists in root folder; `.github/` copy where needed
3. **Naming conventions**: Filenames match patterns (`{technology}.instructions.md`, etc.)
4. **README.md sync**: Read `What's Inside` tables — verify all new/changed templates are listed
5. **Cross-references**: Check for broken links or references to renamed/removed files
6. **Lint check**: Run `get_errors` on all modified files

### Validation Report

```
Validation Results:
- Frontmatter: [PASS/FAIL]
- File Placement: [PASS/FAIL]
- Naming: [PASS/FAIL]
- README Sync: [PASS/FAIL]
- Cross-references: [PASS/FAIL]
- Lint: [count] issues
- Overall: [PASS/FAIL]
```

If validation fails, report specific failures. User decides whether to fix or proceed.

## Phase 6: Document

**This phase is MANDATORY** — do not skip, even for "small" changes.

1. **README.md**: Final verification that catalog tables match actual files
2. **ADR**: If new conventions, naming changes, or structural decisions were made, create ADR in `docs/adr/`
3. **Architecture docs**: If folder structure or organizational patterns changed, update `docs/architecture/README.md`
4. **Development docs**: If workflow patterns changed, update `docs/development/README.md`
5. **Prompt craft docs**: If prompt writing techniques were refined, update `docs/prompt-craft/README.md`
6. **Confirm**: List all docs updated (or state "no doc changes needed" with justification)

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Subagent no output | Verify file(s) exist before retry |
| Review REJECTED (attempt ≤ 2) | Insert fix tasks (IDs 100+), **PRESERVE IDs 5-6**, return to Phase 3 |
| Review REJECTED (attempt > 2) | **HALT** — escalate to user with full analysis |
| Template in wrong folder | Move to root authoritative folder, update `.github/` copy |
| README.md out of sync | Must fix before completing Phase 5 |
| Todo list update | **ALWAYS** include ALL phases (IDs 1-6) plus dynamic tasks (100+) |

---

## Rules

- ✅ Research before implementing: existing templates → naming conventions → MCP tools
- ✅ YAGNI: Create only what's specified — no speculative templates
- ✅ Root is authoritative: create in root first, copy to `.github/` if needed
- ✅ Frontmatter is mandatory: every template needs required fields
- ✅ README sync: every add/remove/rename updates catalog tables
- ✅ Use MCP tools for current versions and best practices (all configured)
- ✅ Delegate to Code Review Agent after implementation (Phase 4)
- ✅ Run Phase Transition Check before every phase change
- ✅ Verify IDs 5-6 exist before every todo list update
- ❌ NEVER skip Phase 5 (Validate) or Phase 6 (Document)
- ❌ NEVER write a todo list update without IDs 5-6
- ❌ NEVER return to Phase 2 on review rejection — return to Phase 3 only
- ❌ NEVER create templates only in `.github/` — root is authoritative
