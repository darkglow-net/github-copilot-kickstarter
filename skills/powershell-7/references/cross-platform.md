# Cross-Platform Patterns

PowerShell 7 cross-platform compatibility guidance for Windows, Linux, and macOS. Referenced from the main [SKILL.md](../SKILL.md).

---

## Path Handling (CRITICAL)

```powershell
# CORRECT: Join-Path handles separators on all platforms
$configPath = Join-Path -Path $PSScriptRoot -ChildPath 'config' |
              Join-Path -ChildPath 'settings.json'

# CORRECT: .NET alternative
$logPath = [IO.Path]::Combine($PSScriptRoot, 'logs', 'output.log')

# CORRECT: Platform-specific separator when needed
$sep = [IO.Path]::DirectorySeparatorChar

# WRONG: Hardcoded separators
# $path = "$PSScriptRoot\config\settings.json"
```

---

## Platform Detection

```powershell
if ($IsWindows) {
    # Windows-specific code (registry, services, DPAPI)
}
elseif ($IsLinux) {
    # Linux-specific code
}
elseif ($IsMacOS) {
    # macOS-specific code
}

# Platform-specific config paths
$configDir = if ($IsWindows) {
    Join-Path $env:APPDATA 'MyTool'
} else {
    Join-Path $HOME '.config' 'mytool'
}
```

---

## Platform Differences Table

| Area | Windows | Linux/macOS |
|------|---------|-------------|
| Filesystem case | Case-insensitive | Case-sensitive |
| Path separator | `\` (accepts `/`) | `/` (accepts `\`) |
| Execution policy | Enforced | Ignored (always Unrestricted) |
| Aliases (ls, cp, mv, rm, cat, man) | Map to PS cmdlets | Removed (native commands) |
| `SecureString` | DPAPI-encrypted | **Not encrypted** |
| Profile path | `$HOME\Documents\PowerShell` | `~/.config/powershell` |
| Module path separator | `;` | `:` |
| WMI | Use `Get-CimInstance` | CIM only (no WMI v1) |
| Windows services | Full support | Not available |
| Registry | Full support | Not available |
| Code signing | `Set-AuthenticodeSignature` available | Not available |

---

## Case Sensitivity (HIGH)

- **Filesystem** is case-sensitive on Linux/macOS — `Import-Module MyModule` fails if file is `mymodule.psm1`
- **PowerShell language** remains case-insensitive — commands, parameters, operators
- **Module names must match filename case** on Unix
- **Tab completion** is case-insensitive on all platforms

---

## Credential and Security Differences

- `SecureString` provides **no encryption** on non-Windows — use `Microsoft.PowerShell.SecretManagement` module instead
- Execution policy is ignored on Linux/macOS — never rely on it as a security boundary
- Constrained Language Mode available only on Windows

---

## Removed Aliases on Linux/macOS

These common aliases exist on Windows but are **removed** on non-Windows (they conflict with native commands):

| Alias | Windows Maps To | Linux/macOS |
|-------|----------------|-------------|
| `ls` | `Get-ChildItem` | Native `ls` |
| `cp` | `Copy-Item` | Native `cp` |
| `mv` | `Move-Item` | Native `mv` |
| `rm` | `Remove-Item` | Native `rm` |
| `cat` | `Get-Content` | Native `cat` |
| `man` | `Get-Help` | Native `man` |

**Rule**: Always use full cmdlet names in scripts and modules.

---

## Key Rules

- Never hardcode `\` or `/` — use `Join-Path`
- Module names must match filename case on Linux/macOS
- `SecureString` provides no encryption on non-Windows — use `SecretManagement` module
- Several aliases are removed on non-Windows — use full cmdlet names
- Some .NET Framework APIs are unavailable in .NET Core

---

## References

- [Unix Platform Support](https://learn.microsoft.com/en-us/powershell/scripting/whats-new/unix-support?view=powershell-7.5)
- [Differences from Windows PowerShell](https://learn.microsoft.com/en-us/powershell/scripting/whats-new/differences-from-windows-powershell?view=powershell-7.4)
