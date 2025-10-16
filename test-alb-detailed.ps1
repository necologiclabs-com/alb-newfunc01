#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Detailed ALB Routing Test Report
#>

param(
    [string]$AwsProfile = "yucho-dev",
    [string]$StackName = "AlbNewfuncStack"
)

# Get ALB DNS
$ALB_DNS = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDnsName`].OutputValue' `
    --output text `
    --profile $AwsProfile

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "🎯 ALB ルーティング動作確認レポート" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "`n📍 ALB DNS: $ALB_DNS`n" -ForegroundColor Yellow

$tests = @(
    @{
        Name = "1. デフォルトルート"
        Command = "curl.exe -s http://$ALB_DNS/"
        Expected = "Server 1"
        Description = "ルールにマッチしない場合のデフォルト動作"
    },
    @{
        Name = "2. パスルーティング (/old-api/)"
        Command = "curl.exe -s http://$ALB_DNS/old-api/"
        Expected = "Server 2"
        Description = "/old-api/* パターンにマッチ → Server 2"
    },
    @{
        Name = "3. パスルーティング (/old-api/test.html)"
        Command = "curl.exe -s http://$ALB_DNS/old-api/test.html"
        Expected = "Server 2"
        Description = "/old-api/* 配下の特定ファイル"
    },
    @{
        Name = "4. ホストヘッダールーティング"
        Command = "curl.exe -s -H 'Host: api.example.com' http://$ALB_DNS/"
        Expected = "Server 2"
        Description = "Host: api.example.com → Server 2"
    },
    @{
        Name = "5. クエリパラメータルーティング (v1)"
        Command = "curl.exe -s 'http://$ALB_DNS/?version=v1'"
        Expected = "Server 2"
        Description = "?version=v1 → Server 2"
    },
    @{
        Name = "6. クエリパラメータルーティング (v2)"
        Command = "curl.exe -s 'http://$ALB_DNS/?version=v2'"
        Expected = "Server 1"
        Description = "?version=v2 → Server 1 (デフォルト)"
    }
)

$passed = 0
$failed = 0

foreach ($test in $tests) {
    Write-Host "`n" + ("-" * 80) -ForegroundColor Gray
    Write-Host "📋 $($test.Name)" -ForegroundColor Cyan
    Write-Host "   $($test.Description)" -ForegroundColor Gray
    
    $result = Invoke-Expression $test.Command
    
    if ($result -match $test.Expected) {
        Write-Host "   ✅ PASS: " -ForegroundColor Green -NoNewline
        Write-Host "Response from $($test.Expected)" -ForegroundColor White
        $passed++
    } else {
        Write-Host "   ❌ FAIL: " -ForegroundColor Red -NoNewline
        Write-Host "Expected $($test.Expected)" -ForegroundColor White
        $failed++
    }
    
    # レスポンスのプレビュー
    $preview = ($result -replace '<[^>]+>', '' -replace '\s+', ' ').Trim()
    if ($preview.Length -gt 60) {
        $preview = $preview.Substring(0, 60) + "..."
    }
    Write-Host "   📄 Response: $preview" -ForegroundColor DarkGray
}

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "📊 テスト結果サマリー" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "`n  Total Tests:  $($passed + $failed)" -ForegroundColor White
Write-Host "  ✅ Passed:     $passed" -ForegroundColor Green
Write-Host "  ❌ Failed:     $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "`n  Success Rate: $([math]::Round(($passed / ($passed + $failed)) * 100, 1))%" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })

if ($failed -eq 0) {
    Write-Host "`n  🎉 すべてのテストが成功しました！" -ForegroundColor Green
} else {
    Write-Host "`n  ⚠️  一部のテストが失敗しました。" -ForegroundColor Yellow
}

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "🔍 詳細情報" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "`nALB URL: http://$ALB_DNS" -ForegroundColor Yellow
Write-Host "`n利用可能なテストコマンド:" -ForegroundColor White
Write-Host "  curl http://$ALB_DNS/" -ForegroundColor Gray
Write-Host "  curl http://$ALB_DNS/old-api/" -ForegroundColor Gray
Write-Host "  curl -H 'Host: api.example.com' http://$ALB_DNS/" -ForegroundColor Gray
Write-Host "  curl 'http://$ALB_DNS/?version=v1'" -ForegroundColor Gray
Write-Host "`n" + ("=" * 80) -ForegroundColor Gray
Write-Host ""

exit $failed
