---
description: 'SQLite schema design, query patterns, and security for catalog databases'
applyTo: '**/*.sql'
---

# SQLite Development Standards

## Database Requirements

- **SQLite 3.x** for data storage (not SQL Server)
- **sql.js** for browser-side queries (WebAssembly)
- **Microsoft.Data.Sqlite** for PowerShell/server-side operations

## Schema Design Patterns

```sql
-- Table structure (snake_case naming)
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    size_friendly TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_size ON items(size);
```

**Schema Rules:**
- ✅ Use **snake_case** for all names (tables, columns, indexes)
- ✅ Table names in **singular** form (`items`, `categories`, `metadata`)
- ✅ Primary key always `id INTEGER PRIMARY KEY`
- ✅ Foreign keys: `{parent_table}_id` pattern
- ✅ Store sizes as INTEGER bytes + `*_friendly` TEXT companion
- ✅ Timestamps as TEXT in ISO 8601 format
- ✅ Use `IF NOT EXISTS` for idempotent schema creation

## Query Structure Patterns

```sql
-- Use explicit columns (not SELECT *)
SELECT
    i.id,
    i.name,
    i.size,
    c.title AS category_title
FROM items i
JOIN categories c ON c.id = i.category_id
WHERE i.size > 1000000
ORDER BY i.size DESC
LIMIT 100;

-- CTEs for complex aggregations
WITH category_stats AS (
    SELECT
        category_id,
        AVG(size) AS avg_size,
        COUNT(*) AS item_count
    FROM items
    GROUP BY category_id
)
SELECT * FROM category_stats WHERE avg_size > 500000;
```

**Query Rules:**
- ✅ Always use explicit column lists (not `SELECT *`)
- ✅ Use short table aliases (i=items, c=categories, m=metadata)
- ✅ Use CTEs for multi-step aggregations
- ✅ Use `LIMIT` for large result sets
- ✅ Use `EXPLAIN QUERY PLAN` to verify index usage

## JavaScript Query Patterns

```javascript
// Column whitelist for SQL injection prevention
const ALLOWED_COLUMNS = {
    items: ['id', 'name', 'size', 'category_id'],
    categories: ['id', 'title', 'path']
};

// Named query repository
const QUERY = {
    GET_LARGE_ITEMS: `
        SELECT i.id, i.name, i.size
        FROM items i
        WHERE i.size > ?
        ORDER BY i.size DESC
    `
};

// Validation before query execution
function isValidColumn(table, column) {
    return ALLOWED_COLUMNS[table]?.includes(column);
}
```

**Critical Security Rules:**
- ✅ **ALWAYS** use `?` placeholders (never concatenate)
- ✅ Validate columns against `ALLOWED_COLUMNS` whitelist
- ✅ Validate operators against `ALLOWED_OPERATORS` whitelist
- ✅ Use parameterized queries: `db.query(sql, [param1, param2])`
- ❌ **NEVER**: `"SELECT * FROM " + table` (SQL injection)
- ❌ **NEVER**: `"WHERE column = '" + value + "'"` (SQL injection)

## Performance Patterns

```sql
-- Index frequently queried columns
CREATE INDEX idx_items_size ON items(size);
CREATE INDEX idx_metadata_codec ON metadata(codec);

-- Analyze query performance
EXPLAIN QUERY PLAN SELECT * FROM items WHERE size > 1000000;
```

**Performance Rules:**
- ✅ Create indexes on foreign keys
- ✅ Create indexes on columns used in WHERE/JOIN clauses
- ✅ Use `LIMIT` for large result sets
- ✅ Use `EXPLAIN QUERY PLAN` to verify index usage
- ✅ Free prepared statements after use in sql.js (`stmt.free()`)

## Validation

```powershell
# Validate schema integrity
sqlite3 database.db "PRAGMA integrity_check;"
sqlite3 database.db "PRAGMA foreign_key_check;"
```
