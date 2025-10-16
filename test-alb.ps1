# Test ALB URL Rewrite Functionality
# Usage: .\test-alb.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$AlbDnsName
)

# If ALB DNS name not provided, get it from CloudFormation
if (-not $AlbDnsName) {
    Write-Host "Getting ALB DNS name from CloudFormation..." -ForegroundColor Yellow
    $AlbDnsName = aws cloudformation describe-stacks `
        --stack-name AlbNewfuncStack `
        --query 'Stacks[0].Outputs[?OutputKey==``ALBDnsName``].OutputValue' `
        --output text
    
    if (-not $AlbDnsName) {
        Write-Error "Could not retrieve ALB DNS name. Please provide it as parameter or check if stack is deployed."
        exit 1
    }
    
    Write-Host "ALB DNS Name: $AlbDnsName" -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Testing ALB Routing and Rewrite Rules" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Default route (should go to TargetGroup1/Server1)
Write-Host "Test 1: Default route" -ForegroundColor Yellow
Write-Host "URL: http://$AlbDnsName/" -ForegroundColor Gray
curl -s "http://$AlbDnsName/"
Write-Host "`n"

# Test 2: Path routing /old-api/* (should go to TargetGroup2/Server2)
Write-Host "Test 2: Path routing - /old-api/test" -ForegroundColor Yellow
Write-Host "URL: http://$AlbDnsName/old-api/test" -ForegroundColor Gray
curl -s "http://$AlbDnsName/old-api/test"
Write-Host "`n"

# Test 3: Host header routing (should go to TargetGroup2/Server2)
Write-Host "Test 3: Host header routing - api.example.com" -ForegroundColor Yellow
Write-Host "URL: http://$AlbDnsName/ with Host: api.example.com" -ForegroundColor Gray
curl -s -H "Host: api.example.com" "http://$AlbDnsName/"
Write-Host "`n"

# Test 4: Query parameter routing (should go to TargetGroup2/Server2)
Write-Host "Test 4: Query parameter routing - version=v1" -ForegroundColor Yellow
Write-Host "URL: http://$AlbDnsName/?version=v1" -ForegroundColor Gray
curl -s "http://$AlbDnsName/?version=v1"
Write-Host "`n"

# Test 5: Different query parameter (should go to TargetGroup1/Server1)
Write-Host "Test 5: Default route with different query - version=v2" -ForegroundColor Yellow
Write-Host "URL: http://$AlbDnsName/?version=v2" -ForegroundColor Gray
curl -s "http://$AlbDnsName/?version=v2"
Write-Host "`n"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tests Completed" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Note: If URL rewrite is configured (see URL_REWRITE_GUIDE.md)," -ForegroundColor Magenta
Write-Host "      the paths and headers should be modified before reaching the backend servers." -ForegroundColor Magenta