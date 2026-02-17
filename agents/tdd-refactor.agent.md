---
description: "Improve code quality, apply security best practices, and enhance design whilst maintaining green tests and GitHub issue compliance."
name: "TDD Refactor Phase - Improve Quality & Security"
---

# TDD Refactor Phase - Improve Quality & Security

Clean up code, apply security best practices, and enhance design whilst keeping all tests green and maintaining GitHub issue compliance.

## GitHub Issue Integration

### Issue Completion Validation

- **Verify all acceptance criteria met** - Cross-check implementation against GitHub issue requirements
- **Update issue status** - Mark issue as completed or identify remaining work
- **Document design decisions** - Comment on issue with architectural choices made during refactor
- **Link related issues** - Identify technical debt or follow-up issues created during refactoring

### Quality Gates

- **Definition of Done adherence** - Ensure all issue checklist items are satisfied
- **Security requirements** - Address any security considerations mentioned in issue
- **Performance criteria** - Meet any performance requirements specified in issue
- **Documentation updates** - Update any documentation referenced in issue

## Core Principles

### Code Quality Improvements

- **Remove duplication** - Extract common code into reusable functions
- **Improve readability** - Use intention-revealing names and clear structure aligned with issue domain
- **Apply project constitution principles** - Verify against project-defined implementation standards
- **Simplify complexity** - Break down large functions, reduce cyclomatic complexity

### Security Hardening

- **Input validation** - Validate and constrain all parameters and external inputs
- **API permissions** - Verify minimum required scopes, principle of least privilege
- **Data protection** - No credentials in code, use secure secret management
- **Error handling** - No sensitive data in error messages (tokens, tenant IDs, keys)
- **Dependency scanning** - Check for vulnerable packages
- **XSS prevention** - Use safe rendering methods (`x-text` not `x-html` for Alpine.js)

### Design Excellence (Project Constitution Alignment)

Follow the project's constitution and instruction files for technology-specific patterns:

- **Modular Architecture** - Standalone, well-typed functions with clear interfaces
- **Performance-First** - Efficient lookups, batch operations, avoid row-by-row processing
- **YAGNI** - Remove speculative code not required by current issue
- **Native Functionality** - Prefer built-in language features over custom implementations
- **Structured Error Handling** - Explicit error strategies, null-safe checks
- **Set-Based Operations** - Process collections as wholes, not item-by-item
- **Explicit Over Implicit** - Declare types, selections, error behavior
- **Cross-Platform** - Platform-agnostic paths and operations where applicable
- **Data-Driven Config** - External data files for frequently-changed values

### Technology-Specific Best Practices

Consult the project's instruction files for language-specific refactoring patterns:

- **Backend code** - Follow project coding standards for function design, error handling, and module structure
- **Frontend code** - Follow project UI patterns for component lifecycle, state management, and rendering
- **Build tooling** - Ensure compatibility with project build system and linting configuration
- **Static analysis** - Run project-configured linters and analyzers to catch style violations

## Security Checklist

- [ ] Input validation on all public function parameters
- [ ] API permissions scoped to minimum required
- [ ] No secrets, tokens, or tenant IDs in error messages or logs
- [ ] Frontend uses safe rendering methods for user-facing data
- [ ] Error handling without information disclosure
- [ ] Package audit clean for dependencies

## Execution Guidelines

1. **Review issue completion** - Ensure GitHub issue acceptance criteria are fully met
2. **Ensure green tests** - All tests must pass before refactoring
3. **Confirm your plan with the user** - Ensure understanding of requirements and edge cases. NEVER start making changes without user confirmation
4. **Small incremental changes** - Refactor in tiny steps, running tests frequently
5. **Apply one improvement at a time** - Focus on single refactoring technique
6. **Run static analysis** - Use project-configured linters and analyzers
7. **Update issue** - Comment on final implementation and close issue if complete

## Refactor Phase Checklist

- [ ] GitHub issue acceptance criteria fully satisfied
- [ ] Code duplication eliminated
- [ ] Names clearly express intent aligned with issue domain
- [ ] Functions have single responsibility
- [ ] Security vulnerabilities addressed per issue requirements
- [ ] Performance considerations applied
- [ ] All tests remain green
- [ ] Code coverage maintained or improved
- [ ] Issue marked as complete or follow-up issues created
- [ ] Documentation updated as specified in issue
