---
description: 'Alpine.js 3.x, Chart.js 4.x, JSZip patterns for interactive dashboards'
applyTo: '**/*.{js,html}'
---

# Dashboard Development Standards

## Technology Stack

- **Alpine.js 3.x** for reactive UI (CDN or bundled via esbuild)
- **Chart.js 4.x** for data visualization
- **JSZip 3.x** for client-side ZIP/export generation
- **sql.js** for SQLite WebAssembly queries (optional)

## Alpine.js Component Pattern

```javascript
// Component factory pattern (REQUIRED)
function createDashboardComponent() {
    return {
        loaded: false,
        loading: false,
        error: null,

        async init() {
            await this.loadData();
        },

        async loadData() {
            this.loading = true;
            try {
                this.data = await fetchData();
                this.loaded = true;
                await this.$nextTick();  // Wait for DOM update before Chart.js
                this.renderCharts();
            } catch (error) {
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        }
    };
}

// Register with Alpine
document.addEventListener('alpine:init', () => {
    Alpine.data('dashboard', createDashboardComponent);
});
```

**Alpine.js Rules:**
- ✅ Use factory functions returning component objects
- ✅ `x-for` MUST be on `<template>` element with `:key` attribute
- ✅ Use `$nextTick()` before Chart.js rendering after data changes
- ✅ Use try/finally for loading state management
- ✅ Use getters for computed arrays (not Sets — Alpine can't track them)
- ✅ Use `$dispatch()` for cross-component communication
- ❌ Never use arrow functions for methods (breaks `this`)
- ❌ Never use `x-html` with user data (XSS vulnerability — use `x-text`)

## Chart.js v4 Manager Pattern

```javascript
class ChartManager {
    constructor() { this.charts = new Map(); }

    renderChart(chartId, config, data) {
        // Always destroy existing chart (prevent memory leaks)
        if (this.charts.has(chartId)) {
            this.charts.get(chartId).destroy();
        }

        const ctx = document.getElementById(chartId).getContext('2d');
        const chart = new Chart(ctx, {
            type: config.type,
            data: config.data(data),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
        this.charts.set(chartId, chart);
        return chart;
    }
}
```

**Chart.js Rules:**
- ✅ Always destroy charts before re-rendering
- ✅ Use factory functions for chart configurations
- ✅ Set `responsive: true` and `maintainAspectRatio: false`
- ✅ Use Map-based chart registry for lifecycle management

## JSZip Export Pattern

```javascript
async function exportData(data) {
    const zip = new JSZip();
    zip.file('report.csv', generateCsv(data));
    zip.file('report.json', JSON.stringify(data, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.zip';
    a.click();
    URL.revokeObjectURL(url);
}
```

## sql.js Integration (SQLite WebAssembly)

```javascript
// Load database from ArrayBuffer
const db = new SQL.Database(new Uint8Array(buffer));

// ALWAYS use parameterized queries — prevents SQL injection
const stmt = db.prepare('SELECT * FROM items WHERE category = ?');
stmt.bind(['example']);
const results = [];
while (stmt.step()) {
    results.push(stmt.getAsObject());
}
stmt.free();  // Prevent memory leaks

// Column whitelist validation
const ALLOWED_COLUMNS = ['id', 'name', 'category', 'size'];
function isValidColumn(column) {
    return ALLOWED_COLUMNS.includes(column);
}
```

**sql.js Rules:**
- ✅ Always use `?` placeholders (never concatenate SQL)
- ✅ Free prepared statements after use (`stmt.free()`)
- ✅ Validate column names against whitelist before query construction
- ❌ NEVER: `'SELECT * FROM ' + table` (SQL injection)

## Property Naming Convention

- **JavaScript uses camelCase**: `totalFiles`, `itemId`, `seasonNumber`
- **SQLite uses snake_case**: `total_files`, `item_id`, `season_number`
- **Transformation**: Use a `snakeToCamel()` utility in the database layer

## Security Patterns

- **Parameterized queries** — Never concatenate user input into SQL
- **Column whitelist** — Validate column names before query construction
- **XSS prevention** — Use Alpine.js `x-text` directive (auto-escapes)
- **CSP headers** — Content Security Policy defined in HTML `<meta>` tag
