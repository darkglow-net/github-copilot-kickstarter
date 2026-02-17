---
description: 'Playwright TypeScript test generation patterns and best practices'
applyTo: '**'
---

# Playwright TypeScript Test Instructions

## Test Writing Guidelines

### Code Quality Standards
- **Locator Priority**: Prefer locators in this order: `getByRole` → `getByText` → `getByLabel` → `getByTestId` → never raw CSS selectors
- **Locators**: Prioritize user-facing, role-based locators (`getByRole`, `getByLabel`, `getByText`, etc.) for resilience and accessibility. Use `test.step()` to group interactions and improve test readability and reporting.
- **Assertions**: Use auto-retrying web-first assertions. These assertions start with the `await` keyword (e.g., `await expect(locator).toHaveText()`). Avoid `expect(locator).toBeVisible()` unless specifically testing for visibility changes.
- **Timeouts**: Rely on Playwright's built-in auto-waiting mechanisms. Avoid hard-coded waits or increased default timeouts.
- **Clarity**: Use descriptive test and step titles that clearly state the intent. Add comments only to explain complex logic or non-obvious interactions.

### Test Structure
- **Imports**: Start with `import { test, expect } from '@playwright/test';`.
- **Organization**: Group related tests for a feature under a `test.describe()` block.
- **Hooks**: Use `beforeEach` for setup actions common to all tests in a `describe` block (e.g., navigating to a page).
- **Titles**: Follow a clear naming convention, such as `Feature - Specific action or scenario`.

### File Organization
- **Location**: Store all test files in the `tests/` directory.
- **Naming**: Use the convention `<feature-or-page>.spec.ts` (e.g., `login.spec.ts`, `search.spec.ts`).
- **Scope**: Aim for one test file per major application feature or page.

### Assertion Best Practices
- **UI Structure**: Use `toMatchAriaSnapshot` to verify the accessibility tree structure of a component.
- **Element Counts**: Use `toHaveCount` to assert the number of elements found by a locator.
- **Text Content**: Use `toHaveText` for exact text matches and `toContainText` for partial matches.
- **Navigation**: Use `toHaveURL` to verify the page URL after an action.

## Example Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Search Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Search by keyword returns matching results', async ({ page }) => {
    await test.step('Perform search', async () => {
      await page.getByRole('search').click();
      const searchInput = page.getByRole('textbox', { name: 'Search Input' });
      await searchInput.fill('test query');
      await searchInput.press('Enter');
    });

    await test.step('Verify search results', async () => {
      await expect(page.getByRole('main')).toMatchAriaSnapshot(`
        - main:
          - heading "test query" [level=1]
          - heading "search results" [level=2]
          - list "results":
            - listitem:
              - link
      `);
    });
  });
});
```

## Test Execution Strategy

1. **Initial Run**: Execute tests with `npx playwright test --project=chromium`
2. **Debug Failures**: Analyze test failures and identify root causes
3. **Iterate**: Refine locators, assertions, or test logic as needed
4. **Validate**: Ensure tests pass consistently and cover the intended functionality
5. **Report**: Provide feedback on test results and any issues discovered

## Quality Checklist

- [ ] All locators are accessible and specific and avoid strict mode violations
- [ ] Tests are grouped logically and follow a clear structure
- [ ] Assertions are meaningful and reflect user expectations
- [ ] Tests follow consistent naming conventions
- [ ] Code is properly formatted and commented

## Local File Testing (file:// Protocol)

For testing local HTML files (dashboards, reports):

```typescript
import path from 'path';

test.beforeEach(async ({ page }) => {
    const filePath = path.resolve(__dirname, '../dist/index.html');
    await page.goto(`file://${filePath}`);
});
```

## Console Error Detection

Fail tests on unexpected console errors:

```typescript
test('should load without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    expect(errors).toHaveLength(0);
});
```

## Anti-Patterns

- ❌ Never use `test.skip` without a linked issue or clear reason
- ❌ Never use `waitForTimeout()` — use web-first assertions that auto-wait
- ❌ Never use `.isVisible()` for control flow — use `expect().toBeVisible()`
- ❌ Never add conditional logic in tests — each test should have one clear path
