# Copilot Processing Log

## User Request
Generate/update workspace instructions for `workspace-baseline` project — a baseline set of Copilot MD files (agents, prompts, instructions, skills) for initializing new coding projects.

## Key Requirements
- workspace-baseline holds reusable Copilot MD files for new project bootstrapping
- .github instructions assist with developing/enhancing MD files
- Reference StorageScanner and m365reporter for tech stack, testing, coding standards
- Primary tools: PowerShell 7, Pester, Playwright, Vitest, Docker, Alpine.js, JavaScript
- Windows + WSL development, no local Python/Node (Docker isolation)
- Projects: M365 admin tooling, MCP servers, AI agents for M365 Copilot
- Use sequential thinking MCP and awesome-copilot MCP for additional resources
- May reorganize workspace-baseline files; NEVER edit StorageScanner or m365reporter

## Action Plan

### Phase 1: Discovery
- [ ] Search for existing AI convention files across all workspaces
- [ ] Map current workspace-baseline folder structure in detail
- [ ] Read existing copilot-instructions.md if present

### Phase 2: Research
- [ ] Research tech stacks and patterns from StorageScanner
- [ ] Research tech stacks and patterns from m365reporter
- [ ] Use awesome-copilot MCP to find additional MD file resources
- [ ] Use sequential thinking MCP for structuring the baseline

### Phase 3: Plan & Restructure
- [ ] Identify irrelevant files to remove
- [ ] Plan optimal folder structure for baseline objectives
- [ ] Determine which existing files to keep/modify/remove

### Phase 4: Implementation
- [ ] Create/update .github/copilot-instructions.md
- [ ] Reorganize files as needed
- [ ] Remove irrelevant files

### Phase 5: Summary & Feedback
- [ ] Add summary to this file
- [ ] Ask user for feedback on unclear/incomplete sections

---

## Summary

### What Was Done

#### Created
| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Primary AI routing file for workspace-baseline |
| `agents/tdd-red.agent.md` | TDD Red Phase — write failing tests first (PowerShell/Pester + JS/Vitest) |
| `agents/tdd-green.agent.md` | TDD Green Phase — minimal implementation |
| `agents/tdd-refactor.agent.md` | TDD Refactor Phase — quality and security |
| `agents/se-technical-writer.agent.md` | Technical documentation writing |
| `agents/debug.mode.agent.md` | Systematic bug-finding with test-first fix |
| `agents/prompt-builder.agent.md` | Prompt engineering and validation (moved from prompts/) |
| `instructions/playwright-typescript.instructions.md` | Playwright TypeScript testing patterns (from awesome-copilot) |

#### Removed (non-aligned with tech stack)
| File | Reason |
|------|--------|
| `instructions/pcf-react-platform-libraries.instructions.md` | PCF/React — not in user's stack |
| `instructions/reactjs.instructions.md` | React — user uses Alpine.js |
| `instructions/playwright-python.instructions.md` | Python-specific — replaced with TypeScript version |

#### Removed (duplicates — kept in .github/ only)
| File | Canonical Location |
|------|-------------------|
| `instructions/agent-skills.instructions.md` | `.github/instructions/agent-skills.instructions.md` |
| `instructions/ai-prompt-engineering-safety-best-practices.instructions.md` | `.github/instructions/` |
| `instructions/context-engineering.instructions.md` | `.github/instructions/` |

#### Moved
| From | To | Reason |
|------|----|--------|
| `.github/instructions/copilot-sdk-python.instructions.md` | `instructions/copilot-sdk-python.instructions.md` | Template, not meta-tool |
| `prompts/prompt-builder.agent.md` | `agents/prompt-builder.agent.md` | Wrong folder (agent in prompts dir) |

#### Removed (duplicate skill)
| File | Canonical Location |
|------|-------------------|
| `.github/skills/copilot-sdk/` | `skills/copilot-sdk/SKILL.md` (root) |

### Final Structure
```
workspace-baseline/
  .github/
    copilot-instructions.md          # NEW — primary AI routing file
    instructions/                     # Meta-authoring guides (8 files)
      agent-skills.instructions.md
      agents.instructions.md
      ai-prompt-engineering-safety-best-practices.instructions.md
      code-review-generic.instructions.md
      context-engineering.instructions.md
      copilot-thought-logging.instructions.md
      instructions.instructions.md
      prompt.instructions.md
    agents/                           # SpecKit + meta agents (11 files)
    prompts/                          # SpecKit + discovery prompts (14 files)
  instructions/                       # CATALOG — 12 tech-specific templates
  agents/                             # CATALOG — 14 reusable agent definitions
  prompts/                            # CATALOG — 13 reusable prompt triggers
  skills/                             # CATALOG — 1 skill (copilot-sdk)
  .specify/                           # SpecKit templates and scripts
```

### Design Decisions
1. **Clean separation**: No files duplicated between root and .github (except workon prompts intentionally active in both)
2. **Root = templates for export**: Technology-specific files ready for new projects
3. **.github = meta-tools**: Files that help with developing the baseline itself
4. **TDD agents fully language-agnostic**: Methodology-only, no technology-specific code examples
5. **Python files kept**: User uses Python in Docker for MCP servers
6. **Agent generalization**: Removed project-specific and language-specific references

### Iteration 2 Changes (User Feedback)

#### copilot-instructions.md Trimmed
- Removed all StorageScanner/m365reporter references (projects will be detached)
- Removed explicit catalog contents tables (agents discover files on their own)
- Removed SpecKit references (not used for development in this workspace)
- Kept: repo layout, tech stack, hard rules, authoring standards, MCP tools

#### TDD Agents Made Fully Language-Agnostic
- Removed all PowerShell/Pester code examples and patterns
- Removed all JavaScript/Vitest code examples and patterns
- Kept pure methodology: test-first mindset, AAA pattern, execution guidelines, checklists
- Added "Technology Selection" and "Implementation Strategies" sections that defer to project instruction files

#### 8 New Instruction Templates Created (Gap Analysis)
| File | Coverage |
|------|----------|
| `powershell-7.instructions.md` | General PowerShell coding: functions, performance, security, error handling, ShouldProcess, null safety |
| `javascript-es6-browser.instructions.md` | General JS: modules, esbuild bundling, error handling, ESLint, security |
| `alpinejs-chartjs-dashboard.instructions.md` | Alpine.js components, Chart.js lifecycle, JSZip exports, sql.js integration |
| `sqlite-schema-queries.instructions.md` | Schema design, query patterns, JS query security, indexing |
| `markdown-documentation.instructions.md` | File linking, navigation, cross-refs, Mermaid, AI navigation strategies |
| `versioning-management.instructions.md` | SemVer rules, single source of truth, multi-scope versions |
| `microsoft-graph-sdk.instructions.md` | SDK cmdlets, batch API, caching, permission scoping |
| `invokebuild-tasks.instructions.md` | Build task patterns, release/clean/package tasks, VS Code integration |

#### 3 Existing Templates Extended
| File | Added |
|------|-------|
| `powershell-pester-5.instructions.md` | Module loading patterns (Import-Module vs dot-source), non-interactive testing |
| `playwright-typescript.instructions.md` | Locator priority ranking, file:// protocol testing, console error detection, anti-patterns |
| `nodejs-javascript-vitest.instructions.md` | jsdom setup, Alpine.js component mocking, Chart.js mocking, localStorage mocking |

#### workon Prompts Copied to .github/prompts/
- `workon.spec.prompt.md` — now active for spec-driven work in this repo
- `workon.myidea.prompt.md` — now active for ad-hoc work in this repo

### Final Structure (After Iteration 2)
```
workspace-baseline/
  .github/
    copilot-instructions.md          # Primary AI routing (trimmed, no project refs)
    instructions/                     # Meta-authoring guides (8 files)
    agents/                           # SpecKit + meta agents (11 files)
    prompts/                          # SpecKit + discovery + workon prompts (16 files)
  instructions/                       # CATALOG — 20 tech-specific templates
  agents/                             # CATALOG — 14 reusable agent definitions
  prompts/                            # CATALOG — 13 reusable prompt triggers
  skills/                             # CATALOG — 1 skill (copilot-sdk)
  .specify/                           # SpecKit templates and scripts
```

### Iteration 3 Changes (Quality Audit & Structural Improvements)

#### Philosophy Change: Root-Authoritative Ownership Model
- **Root = authoritative library**. All templates originate in root folders.
- **`.github/` = downstream consumer**, drawn from root like any other project would.
- Downstream copies diverge to suit project needs — no sync enforcement.
- Removed old Hard Rule #1 ("No duplicate files") — replaced with "Root is authoritative".
- This workspace is a library/knowledge base, not a version control system.

#### SpecKit Moved to Root Catalog
- Moved 9 agents from `.github/agents/` → `agents/` (speckit.*.agent.md)
- Moved 9 prompts from `.github/prompts/` → `prompts/` (speckit.*.prompt.md)
- Added missing `name` field to all 9 SpecKit agents (Hard Rule #3 fix)
- `.specify/` stays as-is (already root-level)

#### Tools Stripped from All Agent Frontmatter
- Removed `tools:` from 7 agents: research-technical-spike, prompt-builder (root + .github), playwright-tester, critical-thinking, context7, speckit.taskstoissues
- User selects tools at workspace scope — templates should not prescribe them

#### Root Catalog Restored (All Templates Originate Here)
- Copied 8 instruction files from `.github/instructions/` to `instructions/` (root):
  agent-skills, agents, ai-prompt-engineering-safety-best-practices, code-review-generic, context-engineering, copilot-thought-logging, instructions, prompt

#### Catalog Agents Decontaminated
- `code-review.agent.md`: Replaced Constitution Principles I-XIII table with generic project standards table; removed PowerShell-specific checks; made language-agnostic
- `debug-mode.agent.md` (renamed from `debug.mode.agent.md`): Removed Pre-Work Checklist reference; removed `Invoke-Build Test`; updated name field from `debug.mode` to `Debug Mode`

#### Frontmatter Fixes
- `agent-skills.instructions.md` (root + .github): Added proper YAML frontmatter (`description`, `applyTo`)
- `ai-prompt-engineering-safety-best-practices.instructions.md` (root + .github): Normalized `applyTo` from `['*']` to `'**'`
- `copilot-sdk-python.instructions.md`: Removed unexpected `name` field
- `workon.spec.prompt.md`: Added YAML frontmatter (`agent`, `description`)

#### New Files from awesome-copilot
| File | Source | Priority |
|------|--------|----------|
| `instructions/typescript-mcp-server.instructions.md` | awesome-copilot | HIGH — TS MCP server SDK patterns |
| `prompts/typescript-mcp-server-generator.prompt.md` | awesome-copilot | HIGH — complete MCP server scaffolding |
| `instructions/security-and-owasp.instructions.md` | awesome-copilot | MEDIUM — OWASP Top 10 secure coding |

#### `copilot-instructions.md` Updated
- Repository Layout: Root-first layout with ownership model explanation
- Hard Rules: 5 rules (was 6). Rule #1 now "Root is authoritative" instead of "No duplicate files"
- How to Use: Added step 7 "Customize downstream copies — divergence is expected"
- Quality Checklist: "Authoritative version exists in root catalog" replaces location check

### Final Structure (After Iteration 3)
```
workspace-baseline/
  .github/
    copilot-instructions.md          # Routing file (root-authoritative model)
    instructions/                     # 8 meta-authoring guides (drawn from root)
    agents/                           # 2 agents: critical-thinking, prompt-builder
    prompts/                          # 7 prompts: prompt-builder, 4 suggest-awesome, 2 workon
  instructions/                       # ROOT — 30 authoritative instruction templates
  agents/                             # ROOT — 23 authoritative agent definitions
  prompts/                            # ROOT — 23 authoritative prompt triggers
  skills/                             # ROOT — 1 skill (copilot-sdk)
  .specify/                           # SpecKit framework (templates + scripts)
```
