# Workspace Baseline — AI Agent Instructions

**Purpose**: Template catalog of reusable Copilot MD files (agents, prompts, instructions, skills) for bootstrapping new coding projects. Root folders are the authoritative library; `.github/` is a downstream consumer. See `README.md` for full catalog contents, tech stack coverage, and repository structure.

---

## Development Constraints

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
6. **Update README.md** — when adding, removing, or renaming agents, prompts, instructions, or skills, update the corresponding table in the root `README.md` to keep the catalog accurate
7. **Record significant decisions as ADRs** — structural changes, new conventions, philosophy shifts, or technology additions must be captured in `docs/adr/` using the ADR template

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
- [ ] `README.md` tables updated if catalog contents changed
- [ ] ADR created in `docs/adr/` if this is a significant decision or convention change

---

## Documentation Requirements

All documentation lives in the `docs/` folder. Keep it current as the library evolves.

| Area | Path | When to update |
|------|------|----------------|
| **Architecture** | `docs/architecture/` | New structural patterns, design overviews, or system diagrams |
| **ADRs** | `docs/adr/` | Any significant decision: new conventions, philosophy changes, technology additions, structural reorganization |
| **Development** | `docs/development/` | Workflow changes, iteration logs, contributing guidelines |
| **Prompt Craft** | `docs/prompt-craft/` | Prompt experiments, lessons learned, refined techniques |

### README Maintenance

The root `README.md` is the first thing visitors and AI agents read. When catalog contents change:

- **Added a template?** → Add it to the matching `What's Inside` table (Instructions / Agents / Prompts / Skills)
- **Removed or renamed?** → Update or remove the entry
- **New tech stack?** → Update the `Tech Stack Coverage` section
- **New docs area?** → Add a row to the `Docs` table

### ADR Workflow

1. Create a new file in `docs/adr/` named `NNNN-short-title.md` (zero-padded sequence number)
2. Follow the template in `docs/adr/README.md` (Title, Status, Context, Decision, Consequences)
3. Update the index table in `docs/adr/README.md`
4. Set status to **Proposed** initially — change to **Accepted** once confirmed

---

## MCP Tools (Required for External Knowledge)

| Need | Tool |
|------|------|
| PowerShell/.NET patterns | `mcp_microsoftdocs_microsoft_docs_search` |
| Library/framework docs | `mcp_context7_resolve-library-id` → `mcp_context7_get-library-docs` |
| Current versions/APIs | `mcp_brave-search_brave_web_search` |
| Discover community MD files | `mcp_awesome-copil_search_instructions` / `mcp_awesome-copil_search_agents` |
| Complex reasoning | `mcp_sequential-th_sequentialthinking` (min 3 thoughts) |
