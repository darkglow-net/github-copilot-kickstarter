# Workspace Baseline — AI Agent Instructions

**Purpose**: Template catalog of reusable Copilot MD files (agents, prompts, instructions, skills) for bootstrapping new coding projects.

---

## Repository Layout

```
instructions/                     # Root catalog — authoritative templates
agents/                           # Root catalog — authoritative agent definitions
prompts/                          # Root catalog — authoritative prompt triggers
skills/                           # Root catalog — authoritative skill definitions
.specify/                         # SpecKit framework — templates and scripts
.github/                          # Consumer — files drawn from root for THIS workspace
  copilot-instructions.md         # This file — routing for AI agents working here
  instructions/                   # Subset of root instructions active for this workspace
  agents/                         # Subset of root agents active for this workspace
  prompts/                        # Subset of root prompts active for this workspace
```

**Ownership model**:
- **Root folders** = Authoritative library. All templates originate here.
- **`.github/`** = Downstream consumer drawn from root, like any other project would.
- Downstream copies are expected to diverge to suit project needs — no sync enforcement.
- This workspace is a library, not a version control or content moderation system.

---

## Tech Stack Focus

These templates target the following primary technologies:

| Category | Technologies |
|----------|-------------|
| **Backend** | PowerShell 7.5+, InvokeBuild |
| **Testing** | Pester 5.7+, Vitest, Playwright (TypeScript) |
| **Frontend** | Alpine.js 3.x, Chart.js 4.x, HTML5, JavaScript ES6+ |
| **Database** | SQLite (Microsoft.Data.Sqlite, sql.js WASM) |
| **Containerization** | Docker (Python/Node isolation, multi-stage builds) |
| **M365** | Microsoft Graph SDK, Declarative Agents, MCP integration |
| **MCP Servers** | Python (Docker), TypeScript (Docker) |
| **Analysis** | PSScriptAnalyzer (custom rules), esbuild |
| **Workflow** | TDD (Red/Green/Refactor), constitutional development, spec-driven |

### Development Environment
- **OS**: Windows + WSL
- **No local Python/Node** — use Docker isolation for Python and Node.js tooling
- **Package management**: Bundled `lib/` for PowerShell modules, npm for JS build only

---

## Hard Rules

1. **Root is authoritative** — all templates originate in root folders; `.github/` draws from root
2. **Instruction frontmatter** must include `description` and `applyTo` fields
3. **Agent frontmatter** must include `description` and `name` fields
4. **MCP tools are mandatory** for external knowledge — never guess API signatures or version numbers
5. **Subagent delegation** — use subagents for 3+ file research or complex multi-step tasks

---

## How to Use This Baseline

### Initializing a New Project
1. Create new project with `.github/` folder
2. Open workspace-baseline alongside the new project
3. **Start with `copilot-instructions.md`** — adapt the routing file for the new project
4. Cherry-pick instruction files from `instructions/` based on project tech stack
5. Copy agents from `agents/` — TDD agents + debug mode are universal
6. Copy prompts from `prompts/` — `workon.*` prompts are the primary workflow triggers
7. Customize downstream copies to suit the project — divergence is expected

---

## Template Authoring Standards

When creating or modifying templates in this baseline:

### Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Instructions | `{technology}.instructions.md` | `powershell-pester-5.instructions.md` |
| Instructions (testing) | `tests-{framework}.instructions.md` | `tests-pester.instructions.md` |
| Agents | `{purpose}.agent.md` | `tdd-red.agent.md` |
| Prompts | `{workflow}.prompt.md` | `workon.spec.prompt.md` |
| Skills | `{name}/SKILL.md` | `copilot-sdk/SKILL.md` |

### Quality Checklist
- [ ] Frontmatter follows conventions (description, applyTo/name)
- [ ] File targets user's tech stack or is truly universal
- [ ] No project-specific references (namespace, constitution principle numbers)
- [ ] Code examples are technology-appropriate
- [ ] MCP tool references are correct (tool names, parameter patterns)
- [ ] Authoritative version exists in root catalog

---

## MCP Tools (Required for External Knowledge)

| Need | Tool |
|------|------|
| PowerShell/.NET patterns | `mcp_microsoftdocs_microsoft_docs_search` |
| Library/framework docs | `mcp_context7_resolve-library-id` → `mcp_context7_get-library-docs` |
| Current versions/APIs | `mcp_brave-search_brave_web_search` |
| Discover community MD files | `mcp_awesome-copil_search_instructions` / `mcp_awesome-copil_search_agents` |
| Complex reasoning | `mcp_sequential-th_sequentialthinking` (min 3 thoughts) |
