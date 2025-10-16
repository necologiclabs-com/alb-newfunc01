# AWS ALB URL・ホストヘッダー書き換え機能テスト

[![CI](https://github.com/necologiclabs-com/alb-newfunc01/workflows/CI%20-%20Test%20Only/badge.svg)](https://github.com/necologiclabs-com/alb-newfunc01/actions)
[![CD](https://github.com/necologiclabs-com/alb-newfunc01/workflows/CD%20-%20Deploy%20to%20Development/badge.svg)](https://github.com/necologiclabs-com/alb-newfunc01/actions)

このプロジェクトは、AWS Application Load Balancer（ALB）の新しいURL書き換え機能をテストするためのサンプルです。

## 参考資料

[Introducing URL and Host Header Rewrite with AWS Application Load Balancers](https://aws.amazon.com/jp/blogs/networking-and-content-delivery/introducing-url-and-host-header-rewrite-with-aws-application-load-balancers/)

## 機能概要

このサンプルでは、以下の3つのURL書き換えパターンを実装しています：

1. **パスベースの書き換え**: `/old-api/*` → `/new-api/*`
2. **ホストヘッダーの書き換え**: `api.example.com` → `newapi.example.com`
3. **クエリパラメータの書き換え**: `version=v1` → `version=v2&source=rewritten`

## アーキテクチャ

- VPC（2つのアベイラビリティゾーン）
- Application Load Balancer（パブリックサブネット）
- 2つのEC2インスタンス（プライベートサブネット）
  - WebServer1: オリジナルのリクエスト処理
  - WebServer2: 書き換えられたリクエスト処理

## 前提条件

- AWS CLI がインストールされ、適切に設定されていること
- AWS CDK がインストールされていること
- Node.js（推奨バージョン: 18.x）

## デプロイ手順

1. 依存関係のインストール:
```bash
npm install
```

2. TypeScriptのビルド:
```bash
npm run build
```

3. CDKのブートストラップ（初回のみ）:
```bash
npx cdk bootstrap
```

4. スタックのシンセサイズ（CloudFormationテンプレートの生成）:
```bash
npx cdk synth
```

5. スタックのデプロイ:
```bash
npx cdk deploy
```

デプロイには5〜10分程度かかります。完了後、ALBのDNS名が出力されます。

## URL書き換え機能の設定

現在のCDK TypeScript型定義ではURL書き換え機能が完全にサポートされていないため、基本的なルーティングルールとしてデプロイされます。

URL書き換え機能を有効にするには、`URL_REWRITE_GUIDE.md`を参照して、以下のいずれかの方法で手動設定してください：

1. AWS CLI を使用してリスナールールを更新
2. CloudFormationテンプレートを直接編集して再デプロイ
3. AWS Management Console からリスナールールを編集

詳細は [URL_REWRITE_GUIDE.md](./URL_REWRITE_GUIDE.md) を参照してください。

## CI/CD 自動デプロイ

このプロジェクトはGitHub Actionsによる自動デプロイをサポートしています。

### セットアップ

1. **GitHub Secretsの設定**
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

2. **自動実行**
   - プルリクエスト作成時: 自動テスト実行
   - mainブランチへのマージ: 自動デプロイ

詳細は [.github/CICD_SETUP.md](./.github/CICD_SETUP.md) を参照してください。

### 手動デプロイ

GitHub Actions から手動でデプロイすることもできます：

1. リポジトリの **Actions** タブへ移動
2. **CD - Deploy to Development** を選択
3. **Run workflow** をクリック

## テスト方法

デプロイ完了後、出力されるALBのDNS名を使用してテストを実行できます。

### PowerShellスクリプトを使用（推奨）

```powershell
.\test-alb.ps1
```

または、ALB DNS名を直接指定：

```powershell
.\test-alb.ps1 -AlbDnsName "your-alb-dns-name.region.elb.amazonaws.com"
```

### 手動でテスト

### 1. デフォルトルート（Server1へ）
```bash
curl http://ALB_DNS_NAME/
```

### 2. パスルーティング（/old-api/* -> Server2へ）
```bash
curl http://ALB_DNS_NAME/old-api/test
```

### 3. ホストヘッダールーティング（api.example.com -> Server2へ）
```bash
curl -H "Host: api.example.com" http://ALB_DNS_NAME/
```

### 4. クエリパラメータルーティング（version=v1 -> Server2へ）
```bash
curl http://ALB_DNS_NAME/?version=v1
```

## 期待される動作

- **Server1**: デフォルトルートと、条件に一致しないリクエスト
- **Server2**: `/old-api/*`、`Host: api.example.com`、または `version=v1` クエリパラメータを持つリクエスト

URL書き換え機能を設定した場合、Server2に到達する前にURL、ホストヘッダー、またはクエリパラメータが書き換えられます。

## クリーンアップ

```bash
npx cdk destroy
```

## 注意事項

- このサンプルはテスト目的で作成されており、本番環境での使用は想定していません
- EC2インスタンスは最小構成（t3.micro）で作成されます
- HTTPSは設定されていません（HTTPのみ）
- URL書き換え機能は手動設定が必要です（詳細は URL_REWRITE_GUIDE.md を参照）
- デプロイにはAWSの料金が発生します（ALB、EC2、NAT Gatewayなど）

## プロジェクト構成

```
alb-newfunc01/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # CI ワークフロー（テスト）
│   │   ├── cd.yml                 # CD ワークフロー（デプロイ）
│   │   ├── destroy.yml            # スタック削除ワークフロー
│   │   └── scheduled-check.yml    # 定期ヘルスチェック
│   ├── CICD_SETUP.md              # CI/CD詳細ガイド
│   └── QUICKSTART.md              # CI/CDクイックスタート
├── bin/
│   └── alb-newfunc01.ts           # CDK アプリケーションのエントリーポイント
├── lib/
│   └── alb-newfunc-stack.ts       # ALBとEC2リソースの定義
├── test/
│   ├── alb-newfunc-stack.test.ts  # ユニットテスト
│   ├── integration.test.ts        # 統合テスト
│   └── README.md                  # テストガイド
├── setup-cicd.ps1                 # CI/CDセットアップスクリプト
├── test-alb.ps1                   # テスト用PowerShellスクリプト
├── URL_REWRITE_GUIDE.md           # URL書き換え機能の設定ガイド
├── TEST_SUMMARY.md                # テスト概要
├── cdk.json                       # CDK設定
├── jest.config.js                 # Jestテスト設定
├── package.json                   # Node.js依存関係
├── tsconfig.json                  # TypeScript設定
└── README.md                      # このファイル
```

## テスト

このプロジェクトには、ユニットテストと統合テストが含まれています。

### ユニットテスト

CDKスタックの構成を検証します（デプロイ不要）：

```powershell
npm run test:unit
```

**テスト内容:**
- VPC、サブネット、セキュリティグループの設定
- ALBとターゲットグループの構成
- リスナールールの検証
- EC2インスタンスの設定

### 統合テスト

実際にデプロイされたALBに対してHTTPリクエストを送信します（デプロイ必要）：

```powershell
# デプロイ後に実行
npm run test:integration
```

**テスト内容:**
- デフォルトルーティング
- パスベースルーティング
- ホストヘッダールーティング
- クエリパラメータルーティング

詳細は [`test/README.md`](./test/README.md) を参照してください。

## トラブルシューティング

### EC2インスタンスに接続できない
- セキュリティグループが正しく設定されているか確認
- インスタンスがHealthyステータスになるまで待つ（初回起動時は数分かかります）

### ALBからのレスポンスがない
- ターゲットグループのヘルスチェックステータスを確認
- EC2インスタンスでApacheが起動しているか確認

### URL書き換えが機能しない
- リスナールールに`RewriteConfig`が正しく設定されているか確認
- AWS CLIまたはConsoleで設定を確認
- URL_REWRITE_GUIDE.md の手順に従って設定