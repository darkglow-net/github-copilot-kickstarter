# Workspace Baseline

A curated library of reusable GitHub Copilot markdown files — **instructions**, **agents**, **prompts**, and **skills** — for bootstrapping and accelerating new coding projects.

## What This Is

This repository is a knowledge base, not an application. It contains portable template files that teach GitHub Copilot how to work within specific technology stacks, follow development workflows, and maintain code quality standards.

Copy what you need into your project's `.github/` folder, customize to fit, and move on.

## Quick Start

1. Open this workspace alongside your target project in VS Code
2. Copy [`.github/copilot-instructions.md`](.github/copilot-instructions.md) to your project — adapt the routing and tech stack sections
3. Cherry-pick from `instructions/`, `agents/`, `prompts/`, and `skills/` based on your needs
4. Customize downstream copies freely — divergence is expected and encouraged

## Repository Structure

```
instructions/       Coding standards, patterns, and conventions per technology
agents/             Specialized AI personas for specific development tasks
prompts/            Reusable workflow triggers and generators
skills/             Bundled domain knowledge with scripts and reference assets
.specify/           SpecKit framework templates for spec-driven development
.github/            Files active in THIS workspace (drawn from root)
```

**Root folders are the authoritative library.** The `.github/` folder is a downstream consumer — the same way any project would use these files.

## What's Inside

### Instructions (30 templates)

Technology-specific coding standards that Copilot auto-loads based on file type.

| Area | Examples |
|------|----------|
| **Backend** | PowerShell 7, InvokeBuild tasks, Microsoft Graph SDK |
| **Frontend** | JavaScript ES6, Alpine.js + Chart.js dashboards, HTML/CSS |
| **Testing** | Pester 5, Vitest + jsdom, Playwright (TypeScript) |
| **Data** | SQLite schema & queries |
| **Infrastructure** | Docker best practices, TypeScript MCP servers, Python MCP servers |
| **Quality** | Security/OWASP, code review, performance, self-documenting code |
| **Process** | Versioning, documentation updates, spec-driven workflow |
| **Meta** | How to author instructions, agents, prompts, and skills |

### Agents (23 definitions)

Specialized AI personas invoked via `@agent-name` in Copilot Chat.

| Category | Agents |
|----------|--------|
| **TDD Workflow** | `tdd-red`, `tdd-green`, `tdd-refactor` |
| **Quality** | `code-review`, `debug-mode`, `critical-thinking` |
| **Documentation** | `se-technical-writer`, `adr-generator` |
| **Research** | `research-technical-spike`, `context7` |
| **Building** | `prompt-builder`, `playwright-tester`, `4.1-Beast` |
| **M365 / MCP** | `mcp-m365-agent-expert` |
| **SpecKit** | `speckit.specify`, `speckit.plan`, `speckit.tasks`, and 6 more |

### Prompts (23 triggers)

Workflow starters invoked via `/prompt-name` in Copilot Chat.

| Category | Prompts |
|----------|---------|
| **Development** | `workon.myidea` (ad-hoc work), `workon.spec` (spec-driven features) |
| **Scaffolding** | MCP server generators (Python, TypeScript), Dockerfile, Playwright tests |
| **Architecture** | Blueprint generators, tech stack blueprints, `copilot-instructions` starter |
| **SpecKit** | Plan, specify, clarify, analyze, checklist, implement, tasks |

### Skills (11 bundles)

Domain knowledge packages with embedded scripts, references, or assets.

Includes: `copilot-sdk`, `chrome-devtools`, `excalidraw-diagram-generator`, `mcp-cli`, `microsoft-docs`, `microsoft-code-reference`, `microsoft-skill-creator`, `plantuml-ascii`, `prd`, `refactor`, `webapp-testing`

## Tech Stack Coverage

These templates are built around the following technologies, though many are language-agnostic:

- **PowerShell 7.5+** / InvokeBuild / Pester 5.7+
- **JavaScript ES6+** / Alpine.js 3.x / Chart.js 4.x / esbuild
- **TypeScript** / Vitest / Playwright
- **Docker** (Python/Node isolation, multi-stage builds)
- **SQLite** (Microsoft.Data.Sqlite, sql.js WASM)
- **Microsoft 365** / Graph SDK / Declarative Agents / MCP
- **MCP Servers** (Python + TypeScript, Docker-hosted)

## Docs

> *This section will grow as project documentation is added.*

| Area | Path | Description |
|------|------|-------------|
| Architecture | `docs/architecture/` | System design decisions and patterns |
| ADRs | `docs/adr/` | Architecture Decision Records |
| Development | `docs/development/` | Contributing, workflows, and iteration logs |
| Prompt Craft | `docs/prompt-craft/` | Refined prompt techniques and experiments |

## Conventions

- **Instruction files** require `description` and `applyTo` in YAML frontmatter
- **Agent files** require `description` and `name` in YAML frontmatter
- **Naming**: `{technology}.instructions.md`, `{purpose}.agent.md`, `{workflow}.prompt.md`
- **No sync enforcement** — downstream copies in projects are expected to diverge

For full authoring standards and hard rules, see [`.github/copilot-instructions.md`](.github/copilot-instructions.md).

## License

This is a personal template library. See individual files for attribution where sourced from community resources.
