---
description: 'Guidelines for creating high-quality Agent Skills for GitHub Copilot'
applyTo: '**/SKILL.md'
---

# Agent Skills Guidelines

## Key Guidelines

1. **Clear Naming**: Use descriptive, concise names for each skill. The name should reflect the skill's purpose and be unique within the repository.
2. **Comprehensive Description**: Each skill must include a detailed description explaining its function, triggers, and intended use cases.
3. **Consistent Structure**: Follow a standard structure for all SKILL.md files:
   - Frontmatter with `name` and `description`
   - Overview section
   - Prerequisites (if any)
   - Usage examples
   - API references or links (if applicable)
4. **Trigger Keywords**: Clearly list trigger keywords or phrases that activate the skill.
5. **Versioning**: Indicate the version or last updated date in the frontmatter or as a comment.
6. **Testing**: Provide test cases or validation steps to ensure the skill works as intended.
7. **Cross-References**: Link to related skills, instructions, or documentation for discoverability.
8. **Review Process**: All new or updated skills should undergo peer review before merging.
9. **Metadata**: Include any relevant metadata (tags, categories) to aid in search and organization.
10. **Security & Privacy**: Ensure no sensitive data is exposed and follow best practices for secure code and data handling.

## Example SKILL.md Structure

````skill
---
name: example-skill
version: 1.0.0
last_updated: 2026-02-17
description: Example skill for demonstration purposes.
---

# Example Skill

## Overview
This skill demonstrates the required structure and content for a Copilot Agent Skill.

## Prerequisites
- GitHub Copilot CLI installed

## Usage
- Trigger: "example skill"
- Example: "Use the example skill to scaffold a new project."

## Related Skills
- [copilot-sdk](copilot-sdk/SKILL.md)

## Test Cases
- [ ] Validate trigger phrase activates the skill
- [ ] Confirm output matches expected result
````

---

For more information, see the [Copilot Skills documentation](https://github.com/github/awesome-copilot#skills).
