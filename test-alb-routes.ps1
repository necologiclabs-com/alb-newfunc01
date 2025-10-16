#!/usr/bin/env pwsh
<#
.SYNOPSIS
    ALB Routing Test Script
.DESCRIPTION
    Tests various routing patterns configured in the ALB
#>

param(
    [string]$Profile = "yucho-dev",
    [string]$StackName = "AlbNewfuncStack"
)

Write-Host "`n🚀 ALB Routing Tests" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray

# Get ALB DNS name
Write-Host "`n📍 Getting ALB DNS name..." -ForegroundColor Yellow
try {
    $ALB_DNS = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --query 'Stacks[0].Outputs[?OutputKey==`ALBDnsName`].OutputValue' `
        --output text `
        --profile $Profile
    
    if ([string]::IsNullOrWhiteSpace($ALB_DNS)) {
        throw "ALB DNS name not found"
    }
    
    Write-Host "✅ ALB DNS: $ALB_DNS`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get ALB DNS: $_" -ForegroundColor Red
    exit 1
}

# Test function
function Test-Route {
    param(
        [string]$Name,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$ExpectedServer
    )
    
    Write-Host "`n" + ("=" * 70) -ForegroundColor Gray
    Write-Host "📍 $Name" -ForegroundColor Cyan
    Write-Host "   URI: $Uri" -ForegroundColor Gray
    
    if ($Headers.Count -gt 0) {
        Write-Host "   Headers:" -ForegroundColor Gray
        $Headers.GetEnumerator() | ForEach-Object {
            Write-Host "      $($_.Key): $($_.Value)" -ForegroundColor Gray
        }
    }
    
    try {
        $response = Invoke-WebRequest -Uri $Uri -Headers $Headers -UseBasicParsing -ErrorAction Stop
        
        Write-Host "`n✅ Status: $($response.StatusCode)" -ForegroundColor Green
        
        # Extract server info from content
        $content = $response.Content
        if ($content -match '<h1>(Server \d+)') {
            $actualServer = $matches[1]
            Write-Host "✅ Response from: $actualServer" -ForegroundColor Green
            
            if ($ExpectedServer -and $actualServer -ne $ExpectedServer) {
                Write-Host "⚠️  Expected: $ExpectedServer" -ForegroundColor Yellow
            }
        } else {
            Write-Host "⚠️  Could not detect server from response" -ForegroundColor Yellow
        }
        
        # Show content preview
        $preview = $content -replace '<[^>]+>', '' -replace '\s+', ' '
        $preview = $preview.Substring(0, [Math]::Min(100, $preview.Length))
        Write-Host "   Content preview: $preview..." -ForegroundColor Gray
        
        return $true
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "`n❌ Status: $statusCode" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        
        # Try to get response content even on error
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            $preview = $responseBody -replace '<[^>]+>', '' -replace '\s+', ' '
            $preview = $preview.Substring(0, [Math]::Min(100, $preview.Length))
            Write-Host "   Response preview: $preview..." -ForegroundColor Gray
        } catch {
            # Ignore
        }
        
        return $false
    }
}

# Run tests
$results = @()

Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
Write-Host "🧪 Starting Tests..." -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

# Test 1: Default route (Server 1)
$results += Test-Route `
    -Name "Test 1: Default Route" `
    -Uri "http://$ALB_DNS/" `
    -ExpectedServer "Server 1"

# Test 2: Path routing /old-api/* (Server 2)
$results += Test-Route `
    -Name "Test 2: Path Routing (/old-api/test)" `
    -Uri "http://$ALB_DNS/old-api/test" `
    -ExpectedServer "Server 2"

# Test 3: Path routing /old-api/ (Server 2)
$results += Test-Route `
    -Name "Test 3: Path Routing (/old-api/)" `
    -Uri "http://$ALB_DNS/old-api/" `
    -ExpectedServer "Server 2"

# Test 4: Host header routing (Server 2)
$results += Test-Route `
    -Name "Test 4: Host Header Routing (api.example.com)" `
    -Uri "http://$ALB_DNS/" `
    -Headers @{ "Host" = "api.example.com" } `
    -ExpectedServer "Server 2"

# Test 5: Query parameter routing (Server 2)
$results += Test-Route `
    -Name "Test 5: Query Parameter Routing (version=v1)" `
    -Uri "http://$ALB_DNS/?version=v1" `
    -ExpectedServer "Server 2"

# Test 6: Different query parameter (Server 1)
$results += Test-Route `
    -Name "Test 6: Different Query Parameter (version=v2)" `
    -Uri "http://$ALB_DNS/?version=v2" `
    -ExpectedServer "Server 1"

# Test 7: Another path on Server 1
$results += Test-Route `
    -Name "Test 7: Random Path (Default -> Server 1)" `
    -Uri "http://$ALB_DNS/some-random-path" `
    -ExpectedServer "Server 1"

# Summary
Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

$passed = ($results | Where-Object { $_ -eq $true }).Count
$failed = ($results | Where-Object { $_ -eq $false }).Count
$total = $results.Count

Write-Host "`nTotal Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
    Write-Host "`n✨ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some tests failed. Check the results above." -ForegroundColor Yellow
}

Write-Host "`n" + ("=" * 70) -ForegroundColor Gray
Write-Host ""

exit $failed
