---
description: 'Microsoft Graph PowerShell SDK 2.0+ patterns for M365 data retrieval and batch operations'
applyTo: '**/*.ps1'
---

# Microsoft Graph SDK Standards

## SDK Requirements

- **Microsoft Graph PowerShell SDK 2.0+** for all Graph operations
- **Exchange Online Management v3.0+** for Exchange operations
- Use SDK cmdlets exclusively — never use raw REST when a cmdlet exists

## Graph SDK Cmdlet Patterns

```powershell
# ✅ GOOD: Use SDK cmdlets with explicit property selection
$users = Get-MgUser -All -Property 'Id,DisplayName,UserPrincipalName,AccountEnabled'

# ✅ GOOD: Filtered queries to reduce data transfer
$enabledUsers = Get-MgUser -Filter "accountEnabled eq true" -Property 'Id,DisplayName'

# ❌ BAD: REST API when SDK cmdlet exists
Invoke-MgGraphRequest -Method GET -Uri '/users'

# ❌ BAD: Missing -Property (returns all properties — wastes bandwidth)
$users = Get-MgUser -All
```

**SDK Rules:**
- ✅ Always specify `-Property` with only the fields you need
- ✅ Use `-Filter` for server-side filtering (reduces data transfer)
- ✅ Use `-All` to handle pagination automatically
- ❌ Never use `Invoke-MgGraphRequest` when a typed cmdlet exists
- ❌ Never omit `-Property` (returns all properties by default)

## Batch API Pattern

```powershell
# Batch API with GUIDs as request IDs for correlation
$batchRequests = $users | ForEach-Object {
    @{
        Id     = $_.Id  # Use object GUID as batch request ID
        Method = 'GET'
        Url    = "/users/$($_.Id)/licenseDetails"
    }
}

# Process in batches of 20 (Graph API limit)
$batchSize = 20
for ($i = 0; $i -lt $batchRequests.Count; $i += $batchSize) {
    $batch = $batchRequests[$i..([Math]::Min($i + $batchSize - 1, $batchRequests.Count - 1))]
    $response = Invoke-MgGraphRequest -Method POST -Uri '/$batch' -Body @{
        requests = $batch
    }
    # Correlate responses using request ID = user GUID
    foreach ($item in $response.responses) {
        $userId = $item.id
        # Process response for user $userId
    }
}
```

## Caching Pattern

```powershell
# O(1) lookup cache — build once, use many times
$script:SkuLookup = @{}
Get-MgSubscribedSku | ForEach-Object {
    $script:SkuLookup[$_.SkuId] = $_.SkuPartNumber
}

# Lookup in O(1) instead of O(n)
$skuName = $script:SkuLookup[$targetSkuId]
```

**Caching Rules:**
- ✅ Use `$script:` scope for module-level caches
- ✅ Build hashtable caches for O(1) lookups
- ✅ Cache reference data (SKUs, service plans, roles) at session start
- ❌ Never call Graph API repeatedly for the same reference data

## Permission Scoping

```powershell
# Minimum required scopes for the operation
Connect-MgGraph -Scopes @(
    'User.Read.All',
    'Organization.Read.All'
)

# Verify permissions before operations
$context = Get-MgContext
if ('User.Read.All' -notin $context.Scopes) {
    Write-Error "Missing required scope: User.Read.All"
    return
}
```

**Security Rules:**
- ✅ Request minimum required scopes (principle of least privilege)
- ✅ Verify permissions before performing operations
- ✅ Use certificate auth or managed identity for automation
- ❌ Never request `Directory.ReadWrite.All` when read-only suffices
- ❌ Never hardcode tokens or credentials

## Error Handling

```powershell
try {
    $user = Get-MgUser -UserId $UserId -Property 'Id,DisplayName' -ErrorAction Stop
}
catch [Microsoft.Graph.PowerShell.Authentication.Helpers.MsalServiceException] {
    Write-Error "Authentication failed for user '$UserId': $($_.Exception.Message)"
}
catch {
    Write-Error "Failed to retrieve user '$UserId': $($_.Exception.Message). Verify User.Read.All permission."
}
```

**Error Rules:**
- ✅ Include entity ID in error messages for correlation
- ✅ Suggest permission fixes in error messages
- ❌ Never expose tokens, tenant IDs, or keys in error messages
