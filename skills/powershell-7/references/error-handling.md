# Error Handling Patterns

Tiered error handling guidance for PowerShell 7 advanced functions. Referenced from the main [SKILL.md](../SKILL.md).

---

## Tier 1 — Every Function (CRITICAL)

Every advanced function must follow this pattern:

```powershell
function Get-Resource {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ResourceId
    )

    process {
        try {
            # -ErrorAction Stop converts non-terminating errors to terminating
            $result = Get-Item -LiteralPath $ResourceId -ErrorAction Stop
            $result
        }
        catch {
            # ThrowTerminatingError produces clean error pointing to caller
            $PSCmdlet.ThrowTerminatingError($PSItem)
        }
    }
}
```

### Why `$PSCmdlet.ThrowTerminatingError($PSItem)`?

- Produces error messages that point to the **caller**, not the function internals
- Preserves the original exception and stack trace
- Works correctly with `-ErrorAction` on the calling side
- Preferred over bare `throw` inside advanced functions (Kirk Munro pattern)

---

## Tier 2 — Typed Exceptions (HIGH)

### Throwing Typed Exceptions

```powershell
throw [System.IO.FileNotFoundException]::new("Config not found: $path")
throw [System.ArgumentException]::new("Invalid format: $format")
throw [System.InvalidOperationException]::new("Cannot process in current state")
```

### Catching by Type

Order matters — most specific first:

```powershell
try {
    Get-Resource -ResourceId $id
}
catch [System.IO.FileNotFoundException] {
    Write-Warning "Resource missing: $($PSItem.Exception.Message)"
}
catch [System.IO.IOException] {
    Write-Warning "IO error: $($PSItem.Exception.Message)"
}
catch {
    Write-Error "Unexpected: $($PSItem.Exception.Message)"
}
```

### ErrorRecord Construction

For non-terminating errors with rich metadata:

```powershell
if (-not $user) {
    $errorRecord = [System.Management.Automation.ErrorRecord]::new(
        [System.Exception]::new("User not found: $UserId"),
        'UserNotFound',
        [System.Management.Automation.ErrorCategory]::ObjectNotFound,
        $UserId
    )
    $PSCmdlet.WriteError($errorRecord)       # Non-terminating
    # OR
    $PSCmdlet.ThrowTerminatingError($errorRecord)  # Terminating
}
```

---

## Tier 3 — Resource Cleanup (MEDIUM)

### try/finally Pattern

```powershell
$stream = $null
try {
    $stream = [System.IO.StreamWriter]::new($outputPath)
    $stream.WriteLine('data')
}
catch {
    Write-Error "Failed to write: $($PSItem.Exception.Message)"
}
finally {
    if ($stream) {
        $stream.Close()
        $stream.Dispose()
    }
}
```

### Scope-Level ErrorActionPreference

For .NET method calls that don't respect `-ErrorAction`:

```powershell
$ErrorActionPreference = 'Stop'
try {
    [System.IO.File]::ReadAllText($path)
}
catch {
    $PSCmdlet.ThrowTerminatingError($PSItem)
}
```

---

## Key Concepts

### Terminating vs Non-Terminating Errors

| Behavior | Terminating | Non-Terminating |
|----------|------------|-----------------|
| Created by | `throw`, `-ErrorAction Stop` | `Write-Error`, most cmdlet errors |
| Caught by `try/catch` | Yes | Only with `-ErrorAction Stop` |
| Stops pipeline | Yes | No |
| `$PSCmdlet` method | `ThrowTerminatingError()` | `WriteError()` |

### `$PSItem` / `$_` in Catch Blocks

Access these properties in catch blocks:
- `$PSItem.Exception` — the .NET exception object
- `$PSItem.Exception.Message` — human-readable error message
- `$PSItem.InvocationInfo` — source location info
- `$PSItem.ScriptStackTrace` — PowerShell stack trace
- `$PSItem.Exception.InnerException` — wrapped exception (if any)

---

## Error Message Best Practices

```powershell
# Include context: what failed, what value, what to do
Write-Error "Failed to process file '$Path': $($PSItem.Exception.Message). Check file permissions."

# Bracket variables in verbose messages to expose $null
Write-Verbose "Processing [$computerName] with status [$status]"

# Write-Warning for non-blocking issues
Write-Warning "Skipped inaccessible directory: $path"
```

---

## References

- [Everything about Exceptions](https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-exceptions?view=powershell-7.5)
- [Everything about $null](https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-null?view=powershell-7.5)
