# CI/CD セットアップガイド

このプロジェクトはGitHub Actionsを使用した自動デプロイ（CI/CD）をサポートしています。

## 📋 ワークフロー概要

### 1. **CI - Continuous Integration** (`.github/workflows/ci.yml`)

**トリガー:**
- プルリクエスト作成/更新時（mainまたはdevelopブランチ向け）
- developブランチへのプッシュ時

**実行内容:**
- ✅ ユニットテスト実行
- ✅ TypeScriptビルドチェック
- ✅ CDK Diff（変更内容の確認）
- ✅ コードカバレッジレポート生成

**目的:** コードの品質を保証し、デプロイ前に問題を検出

---

### 2. **CD - Continuous Deployment** (`.github/workflows/cd.yml`)

**トリガー:**
- mainブランチへのプッシュ時
- 手動実行（workflow_dispatch）

**実行内容:**
1. ✅ ユニットテスト実行
2. ✅ AWSへのCDKデプロイ
3. ✅ デプロイ完了待機
4. ✅ 統合テスト実行
5. ✅ デプロイ結果通知

**目的:** mainブランチへの変更を自動的にAWSへデプロイ

---

### 3. **Destroy Stack** (`.github/workflows/destroy.yml`)

**トリガー:**
- 手動実行のみ（workflow_dispatch）

**実行内容:**
- ⚠️ CDKスタックの削除

**目的:** テスト環境のクリーンアップ

---

### 4. **Scheduled Health Check** (`.github/workflows/scheduled-check.yml`)

**トリガー:**
- 毎日午前9時（JST）自動実行
- 手動実行（workflow_dispatch）

**実行内容:**
- ✅ スタックの存在確認
- ✅ 統合テスト実行
- ✅ ターゲットグループのヘルスチェック

**目的:** デプロイされた環境の定期的な健全性チェック

---

## 🔧 セットアップ手順

### ステップ1: GitHubリポジトリの設定

1. GitHubリポジトリに移動
2. **Settings** → **Secrets and variables** → **Actions** をクリック

### ステップ2: AWS認証情報の設定

以下のシークレットを作成します：

| シークレット名 | 説明 | 取得方法 |
|--------------|------|---------|
| `AWS_ACCESS_KEY_ID` | AWSアクセスキーID | IAMユーザーから取得 |
| `AWS_SECRET_ACCESS_KEY` | AWSシークレットアクセスキー | IAMユーザーから取得 |

#### AWS IAMユーザーの作成

```bash
# AWS CLIで実行
aws iam create-user --user-name github-actions-deployer

# ポリシーをアタッチ
aws iam attach-user-policy \
  --user-name github-actions-deployer \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# アクセスキーを作成
aws iam create-access-key --user-name github-actions-deployer
```

**必要な権限:**
- EC2
- VPC
- Elastic Load Balancing
- IAM（限定的）
- CloudFormation
- S3（CDKアセット用）

**推奨ポリシー:** `PowerUserAccess` または カスタムポリシー

<details>
<summary>カスタムポリシーの例（クリックして展開）</summary>

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "ec2:*",
        "elasticloadbalancing:*",
        "s3:*",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:CreateInstanceProfile",
        "iam:DeleteInstanceProfile",
        "iam:GetInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile"
      ],
      "Resource": "*"
    }
  ]
}
```
</details>

### ステップ3: GitHub Secretsの追加

1. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. 以下を追加：
   - Name: `AWS_ACCESS_KEY_ID`
   - Value: `<your-access-key-id>`
3. 同様に `AWS_SECRET_ACCESS_KEY` を追加

### ステップ4: 環境の設定（オプション）

GitHub Environments を設定して、承認フローを追加できます：

1. **Settings** → **Environments** → **New environment**
2. 環境名を入力（例: `dev`, `staging`, `prod`）
3. **Environment protection rules** を設定：
   - ✅ Required reviewers（承認者の設定）
   - ✅ Wait timer（待機時間の設定）

---

## 🚀 使い方

### 開発フロー

```
1. feature ブランチで開発
   ↓
2. プルリクエスト作成
   ↓
3. CI ワークフロー実行（自動）
   - ユニットテスト
   - CDK Diff
   ↓
4. レビュー & 承認
   ↓
5. main ブランチにマージ
   ↓
6. CD ワークフロー実行（自動）
   - デプロイ
   - 統合テスト
```

### 手動デプロイ

1. GitHubリポジトリの **Actions** タブへ移動
2. **CD - Deploy to Development** を選択
3. **Run workflow** をクリック
4. 環境を選択（dev/staging/prod）
5. **Run workflow** を実行

### スタックの削除

1. **Actions** → **Destroy Stack** を選択
2. **Run workflow** をクリック
3. Stack name: `AlbNewfuncStack`
4. Confirmation: `destroy` と入力
5. **Run workflow** を実行

---

## 📊 ワークフロー実行状況の確認

### GitHubでの確認

1. リポジトリの **Actions** タブ
2. 実行中/完了したワークフローを確認
3. 詳細ログを確認

### ステータスバッジの追加

README.mdに以下を追加：

```markdown
![CI](https://github.com/necologiclabs-com/alb-newfunc01/workflows/CI%20-%20Test%20Only/badge.svg)
![CD](https://github.com/necologiclabs-com/alb-newfunc01/workflows/CD%20-%20Deploy%20to%20Development/badge.svg)
```

---

## 🔍 トラブルシューティング

### デプロイが失敗する

**問題:** CDK デプロイエラー

**解決策:**
1. AWS認証情報を確認
2. IAM権限を確認
3. CDKブートストラップを実行:
   ```bash
   npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1
   ```

### 統合テストが失敗する

**問題:** ターゲットがUnhealthy

**解決策:**
1. 待機時間を増やす（現在60秒）
2. AWSコンソールでターゲットグループを確認
3. EC2インスタンスのUserDataログを確認:
   ```bash
   aws ssm start-session --target i-xxxxx
   sudo cat /var/log/cloud-init-output.log
   ```

### シークレットが認識されない

**問題:** AWS認証エラー

**解決策:**
1. シークレット名を確認（大文字小文字を区別）
2. シークレットの値にスペースや改行がないか確認
3. リポジトリのシークレット設定を再確認

---

## 🔒 セキュリティのベストプラクティス

### 1. 最小権限の原則
- 必要最小限のIAM権限のみを付与
- `PowerUserAccess` の代わりにカスタムポリシーを推奨

### 2. 短命な認証情報
- アクセスキーを定期的にローテーション
- OIDC（OpenID Connect）の使用を検討

### 3. ブランチ保護
- mainブランチへの直接プッシュを禁止
- プルリクエストとレビューを必須化

### 4. 環境の分離
- dev/staging/prod で異なるAWSアカウントを使用
- GitHub Environments で承認フローを設定

---

## 📈 高度な設定

### OIDC認証の使用（推奨）

アクセスキーの代わりにOIDCを使用：

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
    aws-region: ap-northeast-1
```

**メリット:**
- ✅ 短命な認証情報
- ✅ 自動ローテーション
- ✅ より安全

### Slackへの通知

デプロイ完了時にSlackへ通知：

```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment completed!'
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 複数環境のデプロイ

環境ごとに異なる設定：

```yaml
- name: Deploy to environment
  run: |
    if [ "${{ github.event.inputs.environment }}" == "prod" ]; then
      npx cdk deploy --context env=prod
    else
      npx cdk deploy --context env=dev
    fi
```

---

## 📚 参考資料

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Configure AWS Credentials Action](https://github.com/aws-actions/configure-aws-credentials)
- [OIDC Setup Guide](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)

---

## 🎯 次のステップ

- [ ] GitHub Secretsの設定
- [ ] 初回デプロイの実行
- [ ] ステータスバッジの追加
- [ ] Slack通知の設定
- [ ] OIDCへの移行
- [ ] 本番環境の設定
