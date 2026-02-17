---
description: 'Version management rules for project releases using SemVer and automation'
applyTo: '**/*.psd1,**/package.json,**/CHANGELOG.md,**/README.md'
---

# Version Management Rules

## Single Source of Truth

Every project must have exactly ONE authoritative version location:

| Project Type | Version Source | Example |
|-------------|---------------|---------|
| PowerShell module | Module manifest `ModuleVersion` | `MyModule.psd1` |
| Node.js project | `package.json` `version` | `report-ui/package.json` |
| Build-managed | Build script variable | `Project.build.ps1` |

## When You Change Version

Updating the version source **MUST** also update:

1. `README.md` → Version table or badge
2. `CHANGELOG.md` → New version header with date and description

Prefer using `Invoke-Build Release -Version 'X.Y.Z'` which automates all cascading updates.

## SemVer Bump Rules

- **MAJOR** (X.0.0): Breaking API changes, incompatible schema migrations
- **MINOR** (0.X.0): New features, significant refactors, non-breaking additions
- **PATCH** (0.0.X): Bug fixes, performance improvements, documentation fixes

## Multi-Scope Versions

Projects may have independent version scopes:

| Scope | Example Location | Bump When |
|-------|-----------------|-----------|
| Module/Backend | `ModuleVersion` in `.psd1` | Backend logic changes |
| Frontend/UI | `APP_VERSION` in entry JS | UI architecture changes |
| Schema/Database | `schema_version` in migration | Breaking table/column changes |

Do NOT bump one scope for changes in another scope.

## NEVER

- Set version without updating README version table
- Bump schema version for non-breaking additions
- Commit version changes without CHANGELOG entry
- Bypass `Invoke-Build Release` for version bumps (if automation exists)
