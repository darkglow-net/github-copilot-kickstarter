---
description: 'JavaScript ES6+ patterns for browser applications with esbuild bundling'
applyTo: '**/*.{js,html}'
---

# JavaScript Development Standards

## Language Requirements

- **JavaScript ES6+** with browser compatibility (Chrome, Firefox, Edge, Safari)
- **Module Pattern**: ES6 modules in `src/`, optionally bundled for production
- **esbuild** for bundling (IIFE format, src → dist pipeline)

## ES6 Module Structure

```javascript
'use strict';

import { dependency } from './other-module.js';

export const CONSTANT = 'value';

export function functionName(param) {
    // Implementation
}

// Expose to window for non-module scripts (when not using bundler)
if (typeof window !== 'undefined') {
    window.ModuleName = { CONSTANT, functionName };
}
```

**Module Rules:**
- ✅ Use `'use strict';` at top of file
- ✅ Named exports only (no default exports)
- ✅ Provide `window.ModuleName` fallback when CDN-loaded (non-bundled)
- ✅ Relative paths with `.js` extension for imports
- ✅ JSDoc comments for all public functions

## esbuild Bundle Architecture

```javascript
// src/main.js — Entry point (bundled to dist/bundle.min.js)
import { createComponent } from './components/my-component.js';
```

**Build Commands:**
- `npm run build` — Production bundle (minified, no sourcemaps)
- `npm run build:dev` — Development bundle (sourcemaps)
- `npm run watch` — Watch mode for development
- Output format: IIFE with global namespace

## Error Handling

```javascript
async function loadData() {
    this.loading = true;
    this.error = null;

    try {
        const data = await fetchData();
        if (!data) throw new Error('No data available');
        this.processData(data);
    } catch (error) {
        console.error('Load error:', error);   // Technical log
        this.error = 'Failed to load data.';   // User-friendly message
    } finally {
        this.loading = false;
    }
}
```

**Error Rules:**
- ✅ Always use try/catch for async operations and data processing
- ✅ Log technical errors to console, show user-friendly messages in UI
- ✅ Use `console.warn` and `console.error` only (no `console.log` in production)

## ESLint Configuration

Use ESLint 9 flat config with browser globals:
- `no-unused-vars` with `argsIgnorePattern: "^_"` (prefix unused params with `_`)
- `no-console` warns except for `warn` and `error`
- Add framework globals (Alpine, Chart, JSZip) as readonly

## Security Patterns

- **XSS prevention** — Use text-safe rendering (no `innerHTML` with user data)
- **CSP headers** — Define Content Security Policy in HTML
- **No eval** — Never use `eval()` or `Function()` constructor
- **Sanitize external data** — Validate and sanitize any data from external sources

## Validation

```bash
npm run lint        # ESLint check
npm run test:unit   # Unit tests
npm run build       # Production build
```
