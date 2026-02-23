# Pester 5+ Testing Patterns

Test structure, mocking, and organization patterns for PowerShell 7 with Pester 5. Referenced from the main [SKILL.md](../SKILL.md).

---

## Test Structure (CRITICAL)

```powershell
BeforeAll {
    # Module import — runs once per Describe
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

        It 'Should not throw for valid input' {
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

---

## Mocking (HIGH)

### Basic Mocking

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

    It 'Should handle errors gracefully' {
        Mock Invoke-RestMethod { throw 'Connection refused' }

        { Process-Data -Source 'api' } | Should -Throw
    }
}
```

### Module-Scoped Mocking

When the function under test calls internal (private) functions, mock in the module scope:

```powershell
Describe 'Module internal function' {
    It 'Mocks within module scope' {
        Mock -ModuleName MyModule Get-InternalHelper { return 'mocked' }
        # Test function that calls Get-InternalHelper internally
    }
}
```

### ParameterFilter for Granular Verification

```powershell
Should -Invoke Send-Mail -Times 1 -Exactly -ParameterFilter {
    $To -eq 'admin@example.com' -and
    $Subject -like '*Alert*'
}
```

---

## Test Organization (HIGH)

| Rule | Pattern |
|------|---------|
| One test file per source file | `Get-Thing.ps1` → `Get-Thing.Tests.ps1` |
| Mirror source folder structure | `src/Private/` → `tests/Private/` |
| Describe = function | `Describe 'Get-Thing'` |
| Context = scenario | `Context 'When input is valid'` |
| It = single assertion | `It 'Should return expected value'` |
| Names read as specifications | `It 'Should return $null when user not found'` |
| Arrange-Act-Assert | Setup → Execute → Verify in each `It` block |
| TODO tests use `-Skip` | `It 'Should handle timeout' -Skip { }` |

---

## Setup/Teardown Blocks

| Block | Scope | Use For |
|-------|-------|---------|
| `BeforeAll` | Once per `Describe`/`Context` | Module import, shared fixtures |
| `BeforeEach` | Before each `It` | Per-test isolated state |
| `AfterEach` | After each `It` | Cleanup per test |
| `AfterAll` | Once per `Describe`/`Context` | Shared cleanup |

---

## Common Assertions

```powershell
$result | Should -Be 'expected'                          # Exact equality
$result | Should -BeExactly 'Expected'                   # Case-sensitive
$result | Should -BeNullOrEmpty                           # Null or empty
$result | Should -Not -BeNullOrEmpty                      # Has value
$result | Should -HaveCount 5                             # Collection count
$result | Should -Contain 'item'                          # Collection contains
$result | Should -BeOfType [pscustomobject]               # Type check
$result | Should -BeGreaterThan 0                         # Numeric comparison
{ Do-Thing } | Should -Throw                              # Throws any error
{ Do-Thing } | Should -Throw -ExceptionType ([System.IO.FileNotFoundException])
{ Do-Thing } | Should -Not -Throw                         # No error
```

---

## Test Data Patterns

### Inline Data

```powershell
It 'Should calculate discount for <OrderTotal>' -ForEach @(
    @{ OrderTotal = 50; Expected = 5 }
    @{ OrderTotal = 150; Expected = 22.50 }
) {
    Calculate-Discount -Total $OrderTotal | Should -Be $Expected
}
```

### Fixture Files

```powershell
BeforeAll {
    $fixtureDir = Join-Path $PSScriptRoot 'fixtures'
    $testConfig = Get-Content (Join-Path $fixtureDir 'config.json') | ConvertFrom-Json
}
```

---

## References

- [Pester Quick Start](https://pester.dev/docs/quick-start)
- [Pester Mocking](https://pester.dev/docs/usage/mocking)
- [Pester Assertions](https://pester.dev/docs/assertions/)
