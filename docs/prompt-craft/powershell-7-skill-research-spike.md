# Technical Spike: PowerShell 7 Skill Baseline Research

## Status: Completed

## Date: 2026-02-23

## Objective

Research and compile comprehensive PowerShell 7 best practices for creating a reusable, project-agnostic Copilot skill in the `workspace-baseline` repository. This document serves as the primary research source for building that skill.

---

## Research Findings

### 1. Microsoft Learn Deep Dives Summary

The Microsoft Learn "Deep Dives" series by Kevin Marquette covers foundational PowerShell topics in depth. Key takeaways per topic:

#### Arrays (CRITICAL)

- **Array creation**: Use `@()` for explicit array creation; comma-separated lists also work
- **Multi-line declaration** is preferred for readability and version control diffs
- **Negative indexing**: `-1` gets last item; `$data[0..-1]` does NOT enumerate all items (common trap)
- **Out-of-bounds access** returns `$null` silently — no exception thrown
- **Indexing `$null`** throws `RuntimeException` — always null-check before indexing
- **Pipeline interaction**: Single-item results aren't arrays; wrap in `@()` to guarantee array type
- **`$null` comparison gotcha**: `@($null) -eq $null` returns the `$null` element, which is truthy for count but falsy for comparison
- **Strongly-typed arrays**: `[string[]]$data = 'one','two'` improves type safety

```powershell
# CRITICAL: Prefer direct loop assignment over += for building collections
$results = foreach ($item in $collection) {
    Process-Item $item
}

# For complex accumulation, use List<T>
$list = [System.Collections.Generic.List[string]]::new()
foreach ($item in $collection) {
    $list.Add($item)
}
```

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-arrays?view=powershell-7.5

#### Hashtables (CRITICAL)

- **Ordered hashtables**: Use `[ordered]@{}` to preserve insertion order
- **As lookup tables**: Dramatically faster than repeated `Where-Object` filtering (minutes → sub-second for 10K+ items)
- **Multi-value access**: `$hash['key1','key2']` returns multiple values
- **Splatting**: Use `@params` syntax to pass hashtable as parameters — improves readability for commands with many parameters
- **Enumerating**: `.Keys`, `.Values`, `.GetEnumerator()` — note `.GetEnumerator()` is needed for `foreach` on the hashtable itself
- **Null key gotcha**: Accessing non-existent key returns `$null` silently
- **Case-insensitive by default**: Keys are case-insensitive; use `[hashtable]::new([StringComparer]::Ordinal)` for case-sensitive

```powershell
# Splatting pattern — preferred for readability
$params = @{
    Path        = $filePath
    Destination = $outputPath
    Force       = $true
}
Copy-Item @params

# Hashtable as lookup table — dramatically faster than Where-Object
$lookup = @{}
foreach ($item in $largeCollection) {
    $lookup[$item.Name] = $item
}
$result = $lookup[$searchKey]
```

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-hashtable?view=powershell-7.5

#### PSCustomObject (HIGH)

- **Preferred creation**: `[pscustomobject]@{...}` — faster than `New-Object`
- **Property order preserved** when using `[pscustomobject]@{...}` directly but NOT when casting from a regular hashtable — use `[ordered]@{}` first
- **Dynamic property access**: `$obj.$propertyName` works with variables
- **Testing for properties**: Use `$obj.psobject.Properties.Match('Name').Count` when value could be `$null`
- **Converting to/from hashtable**: Common pattern for serialization
- **Objects are reference types**: Assignment copies the reference, not the value — be aware of mutations

```powershell
# Preferred: Direct creation preserves property order
$user = [pscustomobject]@{
    Name  = 'Alice'
    Email = 'alice@example.com'
    Role  = 'Admin'
}

# From ordered hashtable (order preserved)
$hash = [ordered]@{ Name = 'Bob'; Email = 'bob@example.com' }
$user = [pscustomobject]$hash

# Dynamic property access
$propertyName = 'Email'
$user.$propertyName
```

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-pscustomobject?view=powershell-7.5

#### String Substitution (HIGH)

- **Double quotes** expand variables; **single quotes** are literal
- **Subexpression operator** `$()` required for property access: `"Time: $($obj.CreationTime)"`
- **Format operator** `-f` is preferred for complex formatting: `'Hello, {0} {1}.' -f $first, $last`
- **`.NET format strings`**: `"{0:yyyyMMdd}" -f (Get-Date)` for date/number formatting
- **`-join` operator**: Fastest method for string concatenation from collections
- **`StringBuilder`**: Use for very large string accumulation in tight loops
- **`$()` vs `${}` delineation**: `${variable}suffix` for suffix concatenation without spaces
- **`Join-Path`**: Always use for file paths — handles separators correctly cross-platform

```powershell
# Format operator — preferred for complex strings
'User {0} created at {1:yyyy-MM-dd}' -f $userName, (Get-Date)

# -join for collection to string (fastest)
$lines = foreach ($item in $items) { "- $($item.Name)" }
$output = $lines -join "`n"

# Subexpression for property/method access
"Process count: $($processes.Count)"
```

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-string-substitutions?view=powershell-7.5

#### If/Switch/Regex (MEDIUM)

- **Comparison operators** are case-insensitive by default: `-eq`, `-ne`, `-gt`, `-lt`, `-like`, `-match`
- **Case-sensitive variants**: `-ceq`, `-cne`, `-cmatch`, etc.
- **`$null` placement**: Always place `$null` on the LEFT side: `$null -eq $value` — PSScriptAnalyzer enforces this
- **Collection operators**: `-contains`, `-in`, `-notin` for membership testing
- **`-match` populates `$Matches`** automatic variable with capture groups
- **Switch statement** features: `-Wildcard`, `-Regex`, `-CaseSensitive` parameters; processes arrays automatically; supports `break`/`continue`; can assign result: `$result = switch (...) { ... }`
- **Ternary operator** (PS 7+): `$value = $condition ? 'yes' : 'no'`

```powershell
# $null on the left — PSScriptAnalyzer rule
if ($null -eq $value) { ... }

# Switch with regex — powerful pattern matching
switch -Regex ($message) {
    '^Error'   { Write-Error $_ }
    '^Warning' { Write-Warning $_ }
    default    { Write-Information $_ }
}

# Ternary operator (PowerShell 7+)
$status = $isActive ? 'Active' : 'Inactive'
```

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-if?view=powershell-7.5, https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-switch?view=powershell-7.5

#### Exceptions/Error Handling (CRITICAL)

- **Terminating vs non-terminating**: `throw` creates terminating errors; `Write-Error` creates non-terminating by default
- **`-ErrorAction Stop`**: Converts non-terminating errors to terminating (catchable)
- **Typed exceptions**: Use `throw [System.IO.FileNotFoundException]::new("message")` for specific error types
- **Catch by type**: `catch [System.IO.FileNotFoundException] { ... }` — type hierarchy matters (most specific first)
- **`$PSItem` / `$_`**: Automatic variable in `catch` block — access `.Exception`, `.InvocationInfo`, `.ScriptStackTrace`
- **Re-throw pattern**: Use `throw` (bare) to preserve original stack trace; `throw $PSItem` works but changes line info
- **`$PSCmdlet.ThrowTerminatingError()`**: Best practice for advanced functions — produces clean error messages pointing to caller, not internal code
- **Kirk Munro pattern**: Wrap `begin`/`process`/`end` blocks in `try/catch` with `$PSCmdlet.ThrowTerminatingError($PSItem)` in catch
- **`try` creates terminating errors**: Some non-terminating errors become terminating inside `try/catch` blocks
- **`trap`**: Legacy feature — catches all exceptions in scope, execution continues

```powershell
# CRITICAL: Advanced function error handling pattern
function Get-Resource {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    process {
        try {
            if (-not (Test-Path $Path)) {
                throw [System.IO.FileNotFoundException]::new(
                    "Required file not found: $Path"
                )
            }
            Get-Content -Path $Path -ErrorAction Stop
        }
        catch {
            $PSCmdlet.ThrowTerminatingError($PSItem)
        }
    }
}

# Catch specific exception types (most specific first)
try {
    Get-Resource -Path $path
}
catch [System.IO.FileNotFoundException] {
    Write-Warning "File not found: $($PSItem.Exception.Message)"
}
catch [System.IO.IOException] {
    Write-Warning "IO error: $($PSItem.Exception.Message)"
}
```

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-exceptions?view=powershell-7.5

#### $null (CRITICAL)

- **`$null` is an object** in PowerShell — has a value of NULL, not "nothing"
- **In strings**: `$null` renders as empty string — use brackets in logging: `"Value is [$value]"`
- **In math**: Results vary by position: `$null * 5` = `$null`, `5 * $null` = `0`
- **Indexing `$null`**: Throws `Cannot index into a null array` — always check first
- **`$null` on the left** in comparisons: `$null -eq $value` (PSScriptAnalyzer rule `PSPossibleIncorrectComparisonWithNull`)
- **Truthy evaluation gotcha**: `if ($value)` is NOT the same as `if ($null -ne $value)` — it also fails for `0`, `''`, empty arrays, and `$false`
- **Array with `$null` element**: `@($null) -eq $null` returns the `$null` element, evaluating to `$false` in boolean context
- **Method calls on `$null`**: Throws `You cannot call a method on a null-valued expression`

```powershell
# CRITICAL: Always $null on the left
if ($null -ne $value) { ... }

# Bracket variables in log messages
Write-Verbose "Processing [$computerName] with status [$status]"

# Explicit null check before method calls
if ($null -ne $result) {
    $result.ToString()
}
```

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-null?view=powershell-7.5

#### ShouldProcess (HIGH)

- **`SupportsShouldProcess`** in `[CmdletBinding()]` enables `-WhatIf` and `-Confirm`
- **`$PSCmdlet.ShouldProcess(target, action)`** — returns `$true` if operation should proceed
- **Double as verbose output**: `ShouldProcess` outputs verbose-level confirmation automatically
- **Pass-through**: Explicitly pass `-WhatIf:$WhatIfPreference` to called cmdlets — don't trust automatic propagation
- **`ShouldContinue`**: For operations needing explicit confirmation (destructive, irreversible)
- **`ConfirmImpact`**: Set in `[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]` — High auto-prompts for confirmation

```powershell
function Remove-UserData {
    [CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
    param(
        [Parameter(Mandatory)]
        [string]$UserName
    )

    process {
        if ($PSCmdlet.ShouldProcess($UserName, 'Remove all user data')) {
            # Perform destructive operation
            Remove-Item -Path "Users/$UserName" -Recurse -Force
        }
    }
}
```

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-shouldprocess?view=powershell-7.5

---

### 2. Performance Patterns

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/performance/script-authoring-considerations?view=powershell-7.5

#### Output Suppression (HIGH)

| Method | Relative Speed (PS 7) |
|--------|----------------------|
| `$null = expression` | 1x (fastest) |
| `[void]expression` | ~1.05x |
| `expression > $null` | ~1.13x |
| `expression \| Out-Null` | ~1.48-2.22x |

**Rule**: Use `$null = ` for suppressing output in performance-sensitive code.

#### Array Addition (CRITICAL)

| Method | 5K items | 10K items | 100K items |
|--------|----------|-----------|------------|
| Direct loop assignment | 1x | 1x | 1x |
| `List<T>.Add()` | 4.16x | 281x | 124x |
| `+= operator` | 15x | 3,425x | 18,067x |

**Note**: PowerShell 7.5 optimized `+=` so it no longer creates a new array per operation, but prior versions suffer dramatically.

```powershell
# FASTEST: Direct loop assignment (PowerShell explicit assignment)
$results = foreach ($item in $collection) {
    Process-Item $item
}

# GOOD: List<T> for complex accumulation
$list = [System.Collections.Generic.List[object]]::new()
foreach ($item in $collection) {
    $list.Add((Process-Item $item))
}

# AVOID: += in loops (catastrophic for large collections in PS < 7.5)
# $results = @()
# foreach ($item in $collection) {
#     $results += Process-Item $item
# }
```

#### String Concatenation (CRITICAL)

| Method | 10K iterations | 50K iterations | 100K iterations |
|--------|---------------|---------------|----------------|
| `-join` operator | 1x | 1x | 1x |
| `StringBuilder` | 4.23x | 7.05x | 5.83x |
| `+= operator` | 42x | 330x | 790x |

**Rule**: Use `-join` for string building; `StringBuilder` for very complex scenarios.

```powershell
# FASTEST: -join operator
$output = @(
    foreach ($i in 1..10000) {
        "Line $i"
    }
) -join "`n"
```

#### Object Creation (HIGH)

| Method | Relative Speed |
|--------|---------------|
| `[pscustomobject]@{...}` | 1x |
| `[ordered]@{} → [pscustomobject]` | ~1x |
| `[type]::new()` | ~1.2x |
| `PSObject.Properties.Add` | 7-22x slower |
| `Add-Member` | 12-37x slower |
| `New-Object` | 5-7x slower |

**Rule**: Always use `[pscustomobject]@{...}` or `[ordered]@{} → [pscustomobject]` cast for creating objects.

#### File Processing (HIGH)

```powershell
# SLOW: Idiomatic but slower for large files
Get-Content $path | Where-Object { $_.Length -gt 10 }

# FAST: .NET StreamReader or File.ReadLines
foreach ($line in [System.IO.File]::ReadLines($path)) {
    if ($line.Length -gt 10) {
        $line
    }
}
```

#### Lookup Optimization (CRITICAL)

```powershell
# SLOW: O(n²) — filtering per item
$results = $employees | ForEach-Object {
    $account = $accounts | Where-Object { $_.Name -eq $_.Name }
    # ...
}

# FAST: Build hashtable lookup first — O(n)
$lookup = @{}
foreach ($account in $accounts) {
    $lookup[$account.Name] = $account
}
$results = $employees | ForEach-Object {
    $email = $lookup[$_.Name].Email
    [pscustomobject]@{ Id = $_.Id; Name = $_.Name; Email = $email }
}
```

#### Additional Performance Tips

- **Avoid function calls in tight loops** — 6-7x slower; move the loop inside the function
- **Avoid wrapping cmdlet pipelines** — moving `Export-Csv` outside `ForEach-Object` was 372x faster
- **Collection comparison in `if` statements**: Use `.Where({...}, 'first')` instead of `-like` on collections — stops at first match
- **`Write-Host`** is slower than `[Console]::WriteLine()` but the latter doesn't work in all hosts
- **JIT compilation**: Loops < 300 instructions get JIT-compiled after 16 iterations
- **Type-safe collections**: `List[int]` is faster than `List[object]` due to avoiding boxing

---

### 3. Error Handling Patterns

#### Error Handling Tiers

**Tier 1 — CRITICAL (every function)**:
- `[CmdletBinding()]` on every function
- `try/catch` around risky operations
- `-ErrorAction Stop` on cmdlet calls within `try` blocks
- `$PSCmdlet.ThrowTerminatingError($PSItem)` in advanced function catch blocks

**Tier 2 — HIGH (public functions)**:
- Typed exception throwing and catching
- `$ErrorActionPreference = 'Stop'` at script scope for non-cmdlet .NET calls
- Input validation with `[ValidateNotNullOrEmpty()]`, `[ValidateScript()]`, etc.
- Meaningful error messages that include context (what failed, what value caused it)

**Tier 3 — MEDIUM (complex workflows)**:
- `try/finally` for resource cleanup (streams, connections, disposable objects)
- Inner exception nesting for re-thrown errors
- `Write-Error -Exception` with typed exceptions for non-terminating errors
- ErrorRecord creation with proper category and target object

```powershell
# Tier 1: Basic pattern for every advanced function
function Get-ConfigData {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$ConfigPath
    )

    process {
        try {
            if (-not (Test-Path -LiteralPath $ConfigPath)) {
                throw [System.IO.FileNotFoundException]::new(
                    "Configuration file not found: $ConfigPath"
                )
            }
            Get-Content -LiteralPath $ConfigPath -Raw -ErrorAction Stop |
                ConvertFrom-Json
        }
        catch {
            $PSCmdlet.ThrowTerminatingError($PSItem)
        }
    }
}

# Tier 3: Resource cleanup with try/finally
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

---

### 4. Cross-Platform Patterns

**Source**: https://learn.microsoft.com/en-us/powershell/scripting/whats-new/unix-support?view=powershell-7.5

#### Path Handling (CRITICAL)

- **Always use `Join-Path`** — handles separators correctly on all platforms
- **`[IO.Path]::Combine()`** — .NET alternative, also cross-platform
- **PowerShell cmdlets accept both `/` and `\`** — slash-agnostic
- **Never hardcode `\` or `/`** as path separators
- **`[IO.Path]::DirectorySeparatorChar`** — platform-specific separator when needed

```powershell
# CORRECT: Cross-platform path handling
$configPath = Join-Path -Path $PSScriptRoot -ChildPath 'config' |
              Join-Path -ChildPath 'settings.json'

# CORRECT: .NET alternative
$logPath = [IO.Path]::Combine($PSScriptRoot, 'logs', 'output.log')

# WRONG: Hardcoded separators
# $path = "$PSScriptRoot\config\settings.json"
```

#### Case Sensitivity (HIGH)

- **Filesystem is case-sensitive on Linux/macOS** — `Import-Module MyModule` fails if file is `mymodule.psm1`
- **PowerShell language remains case-insensitive** — commands, parameters, operators
- **Module names must match filename case** on Unix
- **Tab completion** is case-insensitive on all platforms

#### Platform-Specific Considerations (HIGH)

| Area | Windows | Linux/macOS |
|------|---------|-------------|
| Execution policy | Enforced | Ignored (always Unrestricted) |
| Path separator | `\` (also accepts `/`) | `/` (also accepts `\`) |
| Filesystem case | Case-insensitive | Case-sensitive |
| Profile path | `$HOME\Documents\PowerShell` | `~/.config/powershell` |
| Module path separator | `;` | `:` |
| Aliases (ls, cp, mv, rm) | Map to PS cmdlets | Removed (native commands) |
| `SecureString` | DPAPI-encrypted | Not encrypted on Linux/macOS |
| WMI/CIM | Full CIM support | CIM only (no WMI v1) |
| Windows services | Full support | Not available |
| Registry | Full support | Not available |

#### Platform Detection

```powershell
# Platform-specific logic
if ($IsWindows) {
    # Windows-specific code
}
elseif ($IsLinux) {
    # Linux-specific code
}
elseif ($IsMacOS) {
    # macOS-specific code
}

# Environment-based path handling
$configDir = if ($IsWindows) {
    Join-Path $env:APPDATA 'MyTool'
} else {
    Join-Path $HOME '.config' 'mytool'
}
```

---

### 5. Security Best Practices

#### Credential Handling (CRITICAL)

- **Never hardcode credentials** in scripts
- **Always accept `[PSCredential]`** as a parameter type — never separate username/password strings
- **`SecureString` limitations**: Not encrypted on Linux/macOS; best for short-term in-memory protection only
- **Use secret management**: `Microsoft.PowerShell.SecretManagement` module for vault-based secrets
- **PSScriptAnalyzer enforces**: `AvoidUsingPlainTextForPassword`, `UsePSCredentialType`, `AvoidUsingConvertToSecureStringWithPlainText`

```powershell
# CORRECT: PSCredential parameter
function Connect-Service {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [PSCredential]$Credential,

        [Parameter(Mandatory)]
        [string]$ServerUrl
    )

    process {
        # Use credential object directly
        Invoke-RestMethod -Uri $ServerUrl -Credential $Credential
    }
}

# CORRECT: Secret management
$secret = Get-Secret -Name 'ApiKey' -Vault 'MyVault'
```

#### Input Validation (HIGH)

- **Validate all parameters** — use validation attributes
- **`[ValidateNotNullOrEmpty()]`** — prevents `$null` and empty strings
- **`[ValidateScript()]`** — custom validation logic
- **`[ValidateSet()]`** — constrain to known values
- **`[ValidateRange()]`** — numeric bounds
- **`[ValidatePattern()]`** — regex-based validation
- **Avoid `Invoke-Expression`** — PSScriptAnalyzer rule `AvoidUsingInvokeExpression`

```powershell
function Set-Configuration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Name,

        [ValidateSet('Development', 'Staging', 'Production')]
        [string]$Environment = 'Development',

        [ValidateRange(1, 65535)]
        [int]$Port = 8080,

        [ValidateScript({ Test-Path $_ -PathType Leaf })]
        [string]$ConfigFile
    )
    # ...
}
```

#### Code Signing & Execution Policy (MEDIUM)

- Script signing (`Set-AuthenticodeSignature`) only available on Windows
- Execution policy ignored on Linux/macOS
- Use constrained language mode for untrusted scripts on Windows
- Never rely on execution policy as a security boundary

---

### 6. Module Development Patterns

#### Module Structure (HIGH)

```
MyModule/
├── MyModule.psd1          # Module manifest (required)
├── MyModule.psm1          # Root module / loader
├── Public/                # Exported functions (one per file)
│   ├── Get-Thing.ps1
│   └── Set-Thing.ps1
├── Private/               # Internal functions (not exported)
│   ├── Helper.ps1
│   └── Utility.ps1
├── Data/                  # JSON/XML configuration data
├── lib/                   # Bundled dependencies (if needed)
└── en-US/                 # Localization / help files
    └── MyModule-help.xml
```

#### Module Manifest Best Practices (CRITICAL)

```powershell
# Essential manifest fields
@{
    RootModule        = 'MyModule.psm1'
    ModuleVersion     = '1.0.0'
    GUID              = 'unique-guid-here'
    Author            = 'Author Name'
    Description       = 'Module description'
    PowerShellVersion = '7.2'
    FunctionsToExport = @('Get-Thing', 'Set-Thing')
    CmdletsToExport   = @()
    VariablesToExport  = @()
    AliasesToExport    = @()
    PrivateData = @{
        PSData = @{
            Tags       = @('tag1', 'tag2')
            LicenseUri = 'https://...'
            ProjectUri = 'https://...'
        }
    }
}
```

**Key rules**:
- **Always specify `FunctionsToExport`** explicitly — never use `'*'`
- **Set `CmdletsToExport`, `VariablesToExport`, `AliasesToExport` to `@()`** to prevent accidental exports
- **`PowerShellVersion = '7.2'`** minimum for PS 7 targeting (or '7.4' for LTS)
- **Use `CompatiblePSEditions = @('Core')`** for PS 7-only modules
- **Semantic versioning**: Major.Minor.Patch

#### Root Module Loader Pattern (HIGH)

```powershell
# MyModule.psm1 — Dependency-ordered dot-sourcing
$Public = @(Get-ChildItem -Path "$PSScriptRoot/Public/*.ps1" -ErrorAction SilentlyContinue)
$Private = @(Get-ChildItem -Path "$PSScriptRoot/Private/*.ps1" -ErrorAction SilentlyContinue)

# Dot-source private first (dependencies), then public
foreach ($file in @($Private + $Public)) {
    try {
        . $file.FullName
    }
    catch {
        Write-Error "Failed to import $($file.FullName): $_"
    }
}

# Export only public functions
Export-ModuleMember -Function $Public.BaseName
```

---

### 7. Testing Patterns (Pester 5+)

**Source**: Context7 Pester docs (`/pester/docs`)

#### Pester 5 Structure (CRITICAL)

```powershell
BeforeAll {
    # Module import and test setup — runs once per Describe
    . $PSScriptRoot/../src/Private/Get-Thing.ps1
}

Describe 'Get-Thing' {
    Context 'When input is valid' {
        BeforeEach {
            # Per-test setup
            $testData = @{ Name = 'Test'; Value = 42 }
        }

        It 'Should return expected result' {
            $result = Get-Thing -Name 'Test'
            $result | Should -Be 42
        }

        It 'Should not throw' {
            { Get-Thing -Name 'Test' } | Should -Not -Throw
        }
    }

    Context 'When input is invalid' {
        It 'Should throw FileNotFoundException for missing path' {
            { Get-Thing -Path '/nonexistent' } |
                Should -Throw -ExceptionType ([System.IO.FileNotFoundException])
        }
    }
}
```

#### Mocking (HIGH)

```powershell
Describe 'Process-Data' {
    BeforeAll {
        . $PSScriptRoot/../src/Public/Process-Data.ps1
    }

    It 'Should call Get-Content with correct path' {
        Mock Get-Content { return '{"key": "value"}' }

        Process-Data -Path '/test/data.json'

        Should -Invoke Get-Content -Times 1 -Exactly -ParameterFilter {
            $Path -eq '/test/data.json'
        }
    }

    It 'Should handle API errors gracefully' {
        Mock Invoke-RestMethod { throw 'Connection refused' }

        { Process-Data -Source 'api' } | Should -Throw
    }
}

# Module-scoped mocking
Describe 'Internal function mocking' {
    It 'Mocks within module scope' {
        Mock -ModuleName MyModule Get-InternalHelper { return 'mocked' }
        # Test function that calls Get-InternalHelper
    }
}
```

#### Test Organization (HIGH)

- **One test file per source file**: `Get-Thing.ps1` → `Get-Thing.Tests.ps1`
- **Mirror source folder structure** in tests directory
- **Use `Describe`/`Context`/`It`** hierarchy: Describe = function, Context = scenario, It = assertion
- **Test names should read as specifications**: `It 'Should return $null when user not found'`
- **Arrange-Act-Assert** or **Given-When-Then** pattern in each `It` block
- **Mark TODO tests with `-Skip`**: `It 'Should handle timeout' -Skip { }`

---

### 8. Common Pitfalls & Anti-Patterns

#### PowerShell 7 vs 5.1 Migration Gotchas (CRITICAL)

| Breaking Change | Details |
|----------------|---------|
| `.NET method overloads** | `.Split('pq')` behaves differently — must cast to `[char[]]` in PS 7 |
| **WMI cmdlets removed** | `Get-WmiObject` → use `Get-CimInstance` |
| **Workflow removed** | `PSWorkflow` entirely removed — use `ForEach-Object -Parallel` |
| **Modules removed** | `ISE`, `PSScheduledJob`, `PSWorkflow`, `LocalAccounts` |
| **Cmdlets removed** | `Get-EventLog` → use `Get-WinEvent`; `Start-Transaction` (no replacement) |
| **Aliases on Linux/macOS** | `ls`, `cp`, `mv`, `rm`, `cat`, `man` removed — map to native commands |
| **.NET Core subset** | Some .NET Framework APIs unavailable |
| **SecureString** | Not encrypted on non-Windows platforms |
| **Execution policy** | Ignored on Linux/macOS |
| **Case sensitivity** | Filenames and module names are case-sensitive on Unix |

#### Common Anti-Patterns (CRITICAL)

```powershell
# ANTI-PATTERN: Array += in loops
$results = @()
foreach ($item in $largeCollection) {
    $results += $item  # Creates new array each iteration!
}

# ANTI-PATTERN: Write-Host in module functions
function Get-Data {
    Write-Host "Processing..."  # Goes to host, not pipeline
}

# ANTI-PATTERN: $null on right side of comparison
if ($value -eq $null) { }  # Can give unexpected results with arrays

# ANTI-PATTERN: Backtick line continuation
Get-Process | `
    Where-Object CPU -GT 100 | `
    Sort-Object CPU  # Fragile — trailing whitespace breaks it

# ANTI-PATTERN: Using aliases in scripts
gci | ? { $_.Length -gt 1MB } | % { $_.Name }

# ANTI-PATTERN: Invoke-Expression with user input
Invoke-Expression $userInput  # Security vulnerability

# ANTI-PATTERN: Hardcoded path separators
$path = "$root\config\settings.json"  # Breaks on Linux

# ANTI-PATTERN: Not using CmdletBinding
function Do-Thing { param($Name) }  # Missing [CmdletBinding()]

# ANTI-PATTERN: Empty catch blocks
try { risky-operation } catch { }  # Swallows errors silently

# ANTI-PATTERN: Using positional parameters in scripts
Copy-Item "source.txt" "dest.txt" $true  # Unreadable
```

#### Preferred Patterns

```powershell
# Use pipeline continuation with | at end of line (no backtick needed)
Get-Process |
    Where-Object CPU -GT 100 |
    Sort-Object CPU

# Use splatting for many parameters
$params = @{
    Path        = 'source.txt'
    Destination = 'dest.txt'
    Force       = $true
}
Copy-Item @params

# Use full cmdlet names in scripts
Get-ChildItem | Where-Object { $_.Length -gt 1MB } | ForEach-Object { $_.Name }

# Use Join-Path for cross-platform paths
$path = Join-Path $root 'config' | Join-Path -ChildPath 'settings.json'
```

---

### 9. Advanced Patterns

#### Pipeline Design (HIGH)

```powershell
# Full pipeline function with begin/process/end
function ConvertTo-ProcessedItem {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [object]$InputObject,

        [ValidateNotNullOrEmpty()]
        [string]$Prefix = 'PROC'
    )

    begin {
        Write-Verbose "Starting processing with prefix: $Prefix"
        $count = 0
    }

    process {
        $count++
        [pscustomobject]@{
            Id    = '{0}-{1:D4}' -f $Prefix, $count
            Name  = $InputObject.Name
            Value = $InputObject.Value
        }
    }

    end {
        Write-Verbose "Processed $count items"
    }
}
```

#### Splatting (HIGH)

```powershell
# Basic splatting
$params = @{
    Path     = $source
    Filter   = '*.log'
    Recurse  = $true
}
Get-ChildItem @params

# Conditional splatting — add parameters dynamically
$params = @{
    Path = $source
}
if ($recurse) { $params.Recurse = $true }
if ($filter)  { $params.Filter = $filter }
Get-ChildItem @params

# Splatting with pass-through (common) parameters
function Invoke-CustomCommand {
    [CmdletBinding()]
    param(
        [string]$Target,
        [hashtable]$AdditionalParams = @{}
    )

    $baseParams = @{ ComputerName = $Target; ErrorAction = 'Stop' }
    $mergedParams = $baseParams + $AdditionalParams
    Get-CimInstance @mergedParams
}
```

#### Classes (MEDIUM)

```powershell
# PowerShell 5+ class syntax
class ServerInfo {
    [string]$Name
    [string]$IPAddress
    [ValidateRange(1, 65535)]
    [int]$Port

    ServerInfo([string]$name, [string]$ip, [int]$port) {
        $this.Name = $name
        $this.IPAddress = $ip
        $this.Port = $port
    }

    [string] ToString() {
        return '{0} ({1}:{2})' -f $this.Name, $this.IPAddress, $this.Port
    }
}

# Enum definition
enum LogLevel {
    Debug = 0
    Info = 1
    Warning = 2
    Error = 3
    Critical = 4
}
```

#### ForEach-Object -Parallel (PowerShell 7+) (HIGH)

```powershell
# Parallel processing — PS 7+ only
$servers | ForEach-Object -Parallel {
    $server = $_
    $result = Test-Connection -ComputerName $server -Count 1 -Quiet
    [pscustomobject]@{
        Server = $server
        Online = $result
    }
} -ThrottleLimit 10

# With $using: scope for external variables
$credential = Get-Credential
$servers | ForEach-Object -Parallel {
    Invoke-Command -ComputerName $_ -Credential $using:credential -ScriptBlock {
        Get-Service
    }
} -ThrottleLimit 5
```

#### Null-Coalescing and Null-Conditional (PowerShell 7+) (HIGH)

```powershell
# Null-coalescing operator
$value = $config.Setting ?? 'default'

# Null-coalescing assignment
$config.Timeout ??= 30

# Null-conditional member access (PS 7.1+)
$length = ${object}?.Property?.Length

# Pipeline chain operators (PS 7+)
Get-Process notepad && Write-Output "Notepad is running"
Get-Process nonexistent || Write-Output "Process not found"
```

---

### 10. Community Standards

#### PoshCode PowerShell Practice and Style Guide Summary

**Source**: https://github.com/PoshCode/PowerShellPracticeAndStyle, https://poshcode.gitbook.io/powershell-practice-and-style

##### Code Layout & Formatting (HIGH)

- **Indentation**: 4 spaces (no tabs)
- **Brace style**: One True Brace Style (OTBS) — opening brace on same line
- **Line length**: Max 115 characters
- **Blank lines**: One blank line between functions
- **Trailing whitespace**: None
- **File encoding**: UTF-8 with BOM for PS scripts

```powershell
# One True Brace Style (community standard)
function Get-Something {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Name
    )

    if ($Name -eq 'special') {
        Write-Verbose "Special case"
    }
    else {
        Write-Verbose "Normal case"
    }
}
```

##### Naming Conventions (CRITICAL)

- **Functions**: Verb-Noun with approved verbs (`Get-Verb` to list)
- **Parameters**: PascalCase, descriptive
- **Variables**: camelCase for local, PascalCase for script/module scope
- **Constants**: UPPER_SNAKE_CASE or PascalCase
- **Modules**: PascalCase
- **Files**: Match the function/module name

##### Command Design (HIGH)

- Use approved verbs only (`Get-Verb` shows the list)
- Singular nouns
- Support `-WhatIf`/`-Confirm` for state-changing functions
- Use `[CmdletBinding()]` on every function
- Support pipeline input where appropriate
- Use `[OutputType()]` attribute

#### PSScriptAnalyzer Configuration (CRITICAL)

**Source**: https://learn.microsoft.com/en-us/powershell/utility-modules/psscriptanalyzer/rules-recommendations?view=ps-modules

Key rules to enforce:

| Severity | Rule | Description |
|----------|------|-------------|
| Error | `AvoidUsingPlainTextForPassword` | Never use plain text passwords |
| Error | `UsePSCredentialType` | Use PSCredential for credentials |
| Error | `AvoidUsingConvertToSecureStringWithPlainText` | Security risk |
| Error | `AvoidUsingComputerNameHardcoded` | Information disclosure |
| Warning | `AvoidUsingCmdletAliases` | Use full cmdlet names |
| Warning | `AvoidUsingWriteHost` | Use Write-Output/Verbose/Warning |
| Warning | `AvoidUsingPositionalParameters` | Use named parameters |
| Warning | `AvoidGlobalVars` | No global variables |
| Warning | `AvoidUsingInvokeExpression` | Security vulnerability |
| Warning | `AvoidUsingEmptyCatchBlock` | Don't swallow errors |
| Warning | `UseApprovedVerbs` | Get-Verb for approved list |
| Warning | `UseShouldProcessForStateChangingFunctions` | Support -WhatIf |
| Warning | `UseSingularNouns` | Singular nouns for commands |
| Warning | `MissingModuleManifestField` | Required manifest fields |
| Info | `ProvideCommentHelp` | Document functions |

**Recommended PSScriptAnalyzer settings file**:

```powershell
# PSScriptAnalyzerSettings.psd1
@{
    Severity     = @('Error', 'Warning', 'Information')
    ExcludeRules = @()
    Rules        = @{
        PSUseCompatibleSyntax = @{
            Enable         = $true
            TargetVersions = @('7.2', '7.4')
        }
        PSPlaceOpenBrace = @{
            Enable             = $true
            OnSameLine         = $true
            NewLineAfter       = $true
            IgnoreOneLineBlock = $true
        }
        PSPlaceCloseBrace = @{
            Enable             = $true
            NewLineAfter      = $false
            IgnoreOneLineBlock = $true
            NoEmptyLineBefore  = $false
        }
        PSUseConsistentIndentation = @{
            Enable              = $true
            IndentationSize     = 4
            PipelineIndentation = 'IncreaseIndentationForFirstPipeline'
            Kind                = 'space'
        }
        PSUseConsistentWhitespace = @{
            Enable                          = $true
            CheckInnerBrace                = $true
            CheckOpenBrace                 = $true
            CheckOpenParen                 = $true
            CheckOperator                  = $true
            CheckPipe                      = $true
            CheckPipeForRedundantWhitespace = $false
            CheckSeparator                 = $true
            CheckParameter                 = $false
        }
    }
}
```

---

## Key References

### Microsoft Learn — Deep Dives

| Topic | URL |
|-------|-----|
| Deep Dives Overview | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/overview?view=powershell-7.5 |
| Arrays | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-arrays?view=powershell-7.5 |
| Hashtables | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-hashtable?view=powershell-7.5 |
| PSCustomObject | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-pscustomobject?view=powershell-7.5 |
| String Substitution | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-string-substitutions?view=powershell-7.5 |
| If Statement | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-if?view=powershell-7.5 |
| Switch Statement | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-switch?view=powershell-7.5 |
| Exceptions | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-exceptions?view=powershell-7.5 |
| $null | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-null?view=powershell-7.5 |
| ShouldProcess | https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-shouldprocess?view=powershell-7.5 |

### Microsoft Learn — Performance & Platform

| Topic | URL |
|-------|-----|
| Performance Considerations | https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/performance/script-authoring-considerations?view=powershell-7.5 |
| Differences from Windows PowerShell | https://learn.microsoft.com/en-us/powershell/scripting/whats-new/differences-from-windows-powershell?view=powershell-7.4 |
| Unix Platform Differences | https://learn.microsoft.com/en-us/powershell/scripting/whats-new/unix-support?view=powershell-7.5 |
| PSScriptAnalyzer Rules | https://learn.microsoft.com/en-us/powershell/utility-modules/psscriptanalyzer/rules-recommendations?view=ps-modules |
| Module Manifest Guide | https://learn.microsoft.com/en-us/powershell/scripting/developer/module/how-to-write-a-powershell-module-manifest?view=powershell-7.5 |

### Community Resources

| Resource | URL |
|----------|-----|
| PoshCode Style Guide | https://poshcode.gitbook.io/powershell-practice-and-style |
| PoshCode GitHub | https://github.com/PoshCode/PowerShellPracticeAndStyle |
| Pester Documentation | https://pester.dev/docs/quick-start |
| PSScriptAnalyzer | https://github.com/PowerShell/PSScriptAnalyzer |
| PowerShell Gallery Best Practices | https://learn.microsoft.com/en-us/powershell/gallery/concepts/publishing-guidelines |

### Context7 Libraries Used

| Library | ID | Snippets |
|---------|-----|----------|
| PowerShell Docs | `/microsoftdocs/powershell-docs` | 2867 |
| Pester Docs | `/pester/docs` | 928 |

---

## Recommendations for Skill Content

The PowerShell 7 Skill (`SKILL.md`) should be structured as follows:

### Proposed Skill Sections (Priority Order)

1. **Function Template** (CRITICAL) — CmdletBinding, parameter validation, error handling, ShouldProcess, pipeline support, OutputType
2. **Error Handling** (CRITICAL) — Terminating vs non-terminating, try/catch patterns, typed exceptions, ThrowTerminatingError
3. **Performance** (CRITICAL) — Collection building, string concatenation, object creation, lookup optimization, file processing
4. **Data Structures** (CRITICAL) — Arrays, hashtables, PSCustomObject, ordered dictionaries, List<T>
5. **Cross-Platform** (HIGH) — Path handling, case sensitivity, platform detection, SecureString limitations
6. **Security** (HIGH) — Credential handling, input validation, PSScriptAnalyzer security rules, avoiding dangerous cmdlets
7. **Module Development** (HIGH) — Folder structure, manifest, root module loader, export patterns
8. **Testing** (HIGH) — Pester 5 structure, mocking, test organization, naming patterns
9. **String Handling** (HIGH) — Substitution, format operator, -join, StringBuilder, Join-Path
10. **Control Flow** (MEDIUM) — If/switch patterns, $null comparisons, ternary operator, null-coalescing
11. **Pipeline & Splatting** (MEDIUM) — begin/process/end, ValueFromPipeline, splatting patterns
12. **Style & Conventions** (MEDIUM) — PoshCode style guide summary, naming, formatting, PSScriptAnalyzer config
13. **Common Pitfalls** (MEDIUM) — Anti-patterns checklist, 5.1 → 7 migration gotchas
14. **Advanced Patterns** (MEDIUM) — Classes, enums, ForEach-Object -Parallel, null-conditional operators

### Skill Design Notes

- **`applyTo`**: `**/*.ps1` — applies to all PowerShell files
- **Format**: Quick-reference patterns with code examples (not tutorial-style prose)
- **Priority markers**: Use CRITICAL / HIGH / MEDIUM labels for AI to prioritize
- **Anti-pattern examples**: Include "AVOID" / "PREFER" pairs for maximum AI guidance
- **Cross-references**: Link to Microsoft Learn deep dives for full context
- **PSScriptAnalyzer settings**: Include recommended configuration as a reference section
- **Project-agnostic**: No references to specific projects, APIs, or business logic

### Estimated Size

~800-1200 lines for a comprehensive skill covering all 14 sections with code examples.
