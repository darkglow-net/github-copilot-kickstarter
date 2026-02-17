---
description: "Guidelines for writing Node.js and JavaScript code with Vitest testing"
applyTo: '**/*.js, **/*.mjs, **/*.cjs'
---

# Code Generation Guidelines

## Coding standards
- Use JavaScript with ES2022 features and Node.js (20+) ESM modules
- Use Node.js built-in modules and avoid external dependencies where possible
- Ask the user if you require any additional dependencies before adding them
- Always use async/await for asynchronous code, and use 'node:util' promisify function to avoid callbacks
- Keep the code simple and maintainable
- Use descriptive variable and function names
- Do not add comments unless absolutely necessary, the code should be self-explanatory
- Never use `null`, always use `undefined` for optional values
- Prefer functions over classes

## Testing
- Use Vitest for testing
- Write tests for all new features and bug fixes
- Ensure tests cover edge cases and error handling
- NEVER change the original code to make it easier to test, instead, write tests that cover the original code as it is

## Browser Environment Testing (jsdom)

For testing browser-dependent code (Alpine.js components, Chart.js, DOM):

```javascript
// vitest.config.js
export default defineConfig({
    test: {
        environment: 'jsdom',
        setupFiles: ['./tests/setup.js']
    }
});

// tests/setup.js — Mock browser globals
global.window.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value; },
    clear() { this.store = {}; }
};
```

### Mocking Alpine.js Components

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DashboardComponent', () => {
    let component;

    beforeEach(() => {
        component = createDashboardComponent();
        component.$nextTick = vi.fn(cb => cb?.());
        component.$dispatch = vi.fn();
    });

    it('should initialize with loading state', () => {
        expect(component.loaded).toBe(false);
    });
});
```

### Mocking Chart.js

```javascript
vi.mock('chart.js', () => ({
    Chart: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
        update: vi.fn()
    }))
}));
```

## Documentation
- When adding new features or making significant changes, update the README.md file where necessary

## User interactions
- Ask questions if you are unsure about the implementation details, design choices, or need clarification on the requirements
- Always answer in the same language as the question, but use english for the generated content like code, comments or docs
