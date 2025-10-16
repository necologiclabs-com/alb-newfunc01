# GitHub Actions CI/CD セットアップスクリプト

Write-Host "🚀 GitHub Actions CI/CD セットアップ" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 前提条件のチェック
Write-Host "📋 前提条件のチェック..." -ForegroundColor Yellow

# Git リポジトリの確認
if (-not (Test-Path ".git")) {
    Write-Host "❌ Gitリポジトリが見つかりません" -ForegroundColor Red
    Write-Host "先に 'git init' を実行してください" -ForegroundColor Yellow
    exit 1
}

# GitHub CLI の確認
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghInstalled) {
    Write-Host "❌ GitHub CLI (gh) がインストールされていません" -ForegroundColor Red
    Write-Host "インストール: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 前提条件OK`n" -ForegroundColor Green

# GitHub リポジトリの確認
Write-Host "📦 GitHubリポジトリの確認..." -ForegroundColor Yellow

try {
    $repoInfo = gh repo view --json nameWithOwner,url 2>&1
    if ($LASTEXITCODE -eq 0) {
        $repo = $repoInfo | ConvertFrom-Json
        Write-Host "✅ リポジトリ: $($repo.nameWithOwner)" -ForegroundColor Green
        Write-Host "   URL: $($repo.url)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️ GitHubリポジトリが見つかりません" -ForegroundColor Yellow
        Write-Host "まずリポジトリを作成してください:" -ForegroundColor Yellow
        Write-Host "  gh repo create alb-newfunc01 --public" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "❌ GitHubリポジトリの確認に失敗しました" -ForegroundColor Red
    exit 1
}

# AWS認証情報の取得
Write-Host "`n🔐 AWS認証情報の設定..." -ForegroundColor Yellow

# 既存のシークレットをチェック
$existingSecrets = gh secret list 2>&1
$hasAccessKey = $existingSecrets -like "*AWS_ACCESS_KEY_ID*"
$hasSecretKey = $existingSecrets -like "*AWS_SECRET_ACCESS_KEY*"

if ($hasAccessKey -and $hasSecretKey) {
    Write-Host "✅ AWS認証情報は既に設定されています" -ForegroundColor Green
    $overwrite = Read-Host "上書きしますか？ (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "スキップします" -ForegroundColor Gray
        $hasAccessKey = $true
        $hasSecretKey = $true
    } else {
        $hasAccessKey = $false
        $hasSecretKey = $false
    }
}

if (-not $hasAccessKey -or -not $hasSecretKey) {
    Write-Host "`nAWS認証情報を入力してください:" -ForegroundColor Cyan
    
    $accessKeyId = Read-Host "AWS Access Key ID"
    $secretAccessKey = Read-Host "AWS Secret Access Key" -AsSecureString
    $secretAccessKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretAccessKey)
    )
    
    # シークレットの設定
    Write-Host "`n設定中..." -ForegroundColor Yellow
    
    try {
        # Access Key ID
        $accessKeyId | gh secret set AWS_ACCESS_KEY_ID
        Write-Host "✅ AWS_ACCESS_KEY_ID を設定しました" -ForegroundColor Green
        
        # Secret Access Key
        $secretAccessKeyPlain | gh secret set AWS_SECRET_ACCESS_KEY
        Write-Host "✅ AWS_SECRET_ACCESS_KEY を設定しました" -ForegroundColor Green
    } catch {
        Write-Host "❌ シークレットの設定に失敗しました: $_" -ForegroundColor Red
        exit 1
    }
}

# ワークフローファイルの確認
Write-Host "`n📄 ワークフローファイルの確認..." -ForegroundColor Yellow

$workflows = @(
    ".github/workflows/ci.yml",
    ".github/workflows/cd.yml",
    ".github/workflows/destroy.yml",
    ".github/workflows/scheduled-check.yml"
)

$allExists = $true
foreach ($workflow in $workflows) {
    if (Test-Path $workflow) {
        Write-Host "✅ $workflow" -ForegroundColor Green
    } else {
        Write-Host "❌ $workflow が見つかりません" -ForegroundColor Red
        $allExists = $false
    }
}

if (-not $allExists) {
    Write-Host "`n⚠️ 一部のワークフローファイルが見つかりません" -ForegroundColor Yellow
    exit 1
}

# Git の状態確認
Write-Host "`n📝 Gitの状態確認..." -ForegroundColor Yellow

$status = git status --porcelain
if ($status) {
    Write-Host "変更されたファイルがあります:" -ForegroundColor Yellow
    git status --short
    
    $commit = Read-Host "`nコミットしますか？ (y/N)"
    if ($commit -eq "y" -or $commit -eq "Y") {
        git add .
        git commit -m "Add GitHub Actions CI/CD workflows"
        Write-Host "✅ コミットしました" -ForegroundColor Green
        
        $push = Read-Host "プッシュしますか？ (y/N)"
        if ($push -eq "y" -or $push -eq "Y") {
            git push
            Write-Host "✅ プッシュしました" -ForegroundColor Green
        }
    }
} else {
    Write-Host "✅ コミットする変更はありません" -ForegroundColor Green
}

# 完了メッセージ
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✨ セットアップ完了！" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "次のステップ:" -ForegroundColor Yellow
Write-Host "1. GitHubで Actions タブを確認" -ForegroundColor White
Write-Host "   $($repo.url)/actions" -ForegroundColor Gray
Write-Host "`n2. プルリクエストを作成してCI/CDをテスト" -ForegroundColor White
Write-Host "   git checkout -b feature/test" -ForegroundColor Gray
Write-Host "   git push -u origin feature/test" -ForegroundColor Gray
Write-Host "`n3. または手動でデプロイを実行" -ForegroundColor White
Write-Host "   Actions > CD - Deploy to Development > Run workflow" -ForegroundColor Gray

Write-Host "`n詳細なガイド: .github/CICD_SETUP.md`n" -ForegroundColor Cyan
