# Performance Patterns

Detailed benchmarks and optimization patterns for PowerShell 7. Referenced from the main [SKILL.md](../SKILL.md).

---

## Collection Building (CRITICAL)

```powershell
# FASTEST: Direct loop assignment
$results = foreach ($item in $collection) {
    Process-Item $item
}

# GOOD: List<T> for complex accumulation
$list = [System.Collections.Generic.List[object]]::new()
foreach ($item in $collection) {
    $list.Add((Process-Item $item))
}

# AVOID: += in loops (copies entire array each iteration in PS < 7.5)
# $results = @()
# foreach ($item in $collection) { $results += $item }
```

| Method | 5K items | 10K items | 100K items |
|--------|----------|-----------|------------|
| Direct loop assignment | 1x | 1x | 1x |
| `List<T>.Add()` | ~4x | ~281x | ~124x |
| `+= operator` | ~15x | ~3,425x | ~18,067x |

**Note**: PowerShell 7.5 optimized `+=` so it no longer creates a new array per operation, but prior versions suffer dramatically.

---

## String Building (CRITICAL)

```powershell
# FASTEST: -join operator
$output = @(
    foreach ($i in 1..10000) { "Line $i" }
) -join "`n"

# GOOD: StringBuilder for complex scenarios
$sb = [System.Text.StringBuilder]::new()
foreach ($item in $items) {
    $null = $sb.AppendLine("- $($item.Name)")
}
$result = $sb.ToString()

# AVOID: += for string concatenation in loops
```

| Method | 10K iterations | 50K iterations | 100K iterations |
|--------|---------------|---------------|----------------|
| `-join` | 1x | 1x | 1x |
| `StringBuilder` | ~4x | ~7x | ~6x |
| `+= operator` | ~42x | ~330x | ~790x |

---

## Object Creation (HIGH)

```powershell
# FASTEST: [pscustomobject]@{} — 5-7x faster than New-Object
$obj = [pscustomobject]@{
    Name  = 'Alice'
    Email = 'alice@example.com'
    Role  = 'Admin'
}

# Property order preserved with [pscustomobject]@{} directly
# For hashtables, use [ordered] to preserve order:
$hash = [ordered]@{ Name = 'Bob'; Email = 'bob@example.com' }
$obj = [pscustomobject]$hash
```

| Method | Relative Speed |
|--------|---------------|
| `[pscustomobject]@{...}` | 1x |
| `[ordered]@{} → [pscustomobject]` | ~1x |
| `[type]::new()` | ~1.2x |
| `PSObject.Properties.Add` | 7-22x slower |
| `Add-Member` | 12-37x slower |
| `New-Object` | 5-7x slower |

---

## Lookup Optimization (CRITICAL)

```powershell
# FAST: Hashtable lookup — O(1)
$lookup = @{}
foreach ($item in $largeCollection) {
    $lookup[$item.Id] = $item
}
$result = $lookup[$searchKey]

# SLOW: Where-Object filtering — O(n) per lookup
# $result = $largeCollection | Where-Object { $_.Id -eq $searchKey }
```

For 10K+ item collections, hashtable lookup takes sub-second vs minutes for repeated `Where-Object` filtering.

---

## Output Suppression (HIGH)

| Method | Relative Speed (PS 7) |
|--------|----------------------|
| `$null = expression` | 1x (fastest) |
| `[void]expression` | ~1.05x |
| `expression > $null` | ~1.13x |
| `expression \| Out-Null` | ~1.48-2.22x |

**Rule**: Use `$null = ` for suppressing output in performance-sensitive code.

---

## File Processing (HIGH)

```powershell
# Pipeline (simple, moderate performance)
Get-Content $path | Where-Object { $_.Length -gt 10 }

# .NET (fast, for large files)
foreach ($line in [System.IO.File]::ReadLines($path)) {
    if ($line.Length -gt 10) { $line }
}
```

---

## Collection Filtering (HIGH)

```powershell
# FAST: .Where() with 'first' mode — stops at first match
$match = $items.Where({ $_.Name -eq $target }, 'first')

# SLOWER: Where-Object processes entire collection
$match = $items | Where-Object { $_.Name -eq $target } | Select-Object -First 1
```

---

## Additional Tips

- Avoid function calls inside tight loops — move the loop inside the function (6-7x faster)
- Moving pipeline cmdlets like `Export-Csv` outside `ForEach-Object` was 372x faster in benchmarks
- Use `List[int]` over `List[object]` when types are known — avoids boxing overhead
- JIT compilation kicks in after 16 iterations for loops under 300 instructions

---

## References

- [PowerShell Performance Considerations](https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/performance/script-authoring-considerations?view=powershell-7.5)
