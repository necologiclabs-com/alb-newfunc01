# CI/CD クイックスタートガイド

## 🚀 5分でセットアップ

### 前提条件

- ✅ GitHubアカウント
- ✅ AWSアカウント
- ✅ GitHub CLI (`gh`) がインストール済み

### ステップ1: GitHubリポジトリの作成

```powershell
# リポジトリがない場合
gh repo create alb-newfunc01 --public --source=. --remote=origin --push
```

### ステップ2: AWS認証情報の準備

```bash
# IAMユーザーを作成（AWS CLIで実行）
aws iam create-user --user-name github-actions-deployer

# PowerUserAccess をアタッチ
aws iam attach-user-policy \
  --user-name github-actions-deployer \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# アクセスキーを作成
aws iam create-access-key --user-name github-actions-deployer

# 出力された AccessKeyId と SecretAccessKey をメモ
```

### ステップ3: 自動セットアップスクリプトの実行

```powershell
.\setup-cicd.ps1
```

スクリプトが以下を自動実行します：
1. GitHub CLIの確認
2. リポジトリの確認
3. AWS認証情報の設定（対話式）
4. ワークフローファイルの確認
5. Git コミット & プッシュ（オプション）

### ステップ4: 動作確認

```powershell
# 1. プルリクエストでCIをテスト
git checkout -b feature/test
git commit --allow-empty -m "Test CI"
git push -u origin feature/test

# GitHub上でプルリクエストを作成

# 2. mainにマージしてCDを実行
# GitHubでプルリクエストをマージ

# 3. または手動デプロイ
# GitHub Actions > CD - Deploy to Development > Run workflow
```

---

## 🎯 各ワークフローの実行方法

### CI（自動実行）

**トリガー:** プルリクエスト作成時

```bash
git checkout -b feature/new-feature
# 変更を加える
git add .
git commit -m "Add new feature"
git push -u origin feature/new-feature
# GitHubでプルリクエスト作成 → CI自動実行
```

### CD（自動実行）

**トリガー:** mainブランチへのマージ

```bash
# GitHubでプルリクエストをマージ → CD自動実行
```

### CD（手動実行）

**実行方法:**
1. GitHub リポジトリの **Actions** タブ
2. **CD - Deploy to Development** を選択
3. **Run workflow** ボタンをクリック
4. 環境を選択（dev/staging/prod）
5. **Run workflow** を実行

### Destroy（手動実行）

**実行方法:**
1. **Actions** → **Destroy Stack**
2. **Run workflow** をクリック
3. **stack_name**: `AlbNewfuncStack`
4. **confirmation**: `destroy` と入力
5. **Run workflow** を実行

### Health Check（スケジュール実行）

**自動実行:** 毎日午前9時（JST）

**手動実行:**
1. **Actions** → **Scheduled Health Check**
2. **Run workflow** をクリック

---

## 📊 実行状況の確認

### GitHubで確認

```
リポジトリ → Actions タブ
```

- 🟢 成功: 緑色のチェックマーク
- 🔴 失敗: 赤色のXマーク
- 🟡 実行中: 黄色の丸

### ログの確認

```
Actions → 実行したワークフロー → ジョブ名 → ログ詳細
```

---

## ⚠️ よくある問題と解決方法

### 問題1: AWS認証エラー

```
Error: Unable to locate credentials
```

**解決策:**
```powershell
# シークレットを再設定
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
```

### 問題2: CDK Bootstrap エラー

```
Error: This stack uses assets, so the toolkit stack must be deployed
```

**解決策:**
```bash
# ローカルでブートストラップ
aws configure  # AWS認証情報を設定
npx cdk bootstrap
```

### 問題3: デプロイがタイムアウト

```
Error: Timeout waiting for deployment
```

**解決策:**
```yaml
# .github/workflows/cd.yml の待機時間を増やす
- name: Wait for deployment to be ready
  run: sleep 120  # 60 → 120 に変更
```

---

## 🔧 カスタマイズ

### リージョンの変更

```yaml
# .github/workflows/*.yml
env:
  AWS_REGION: us-east-1  # ap-northeast-1 → us-east-1
```

### スタック名の変更

```yaml
# .github/workflows/cd.yml
- name: CDK Deploy
  run: npx cdk deploy MyCustomStack --require-approval never
```

### 環境変数の追加

```yaml
# .github/workflows/cd.yml
env:
  ENVIRONMENT: production
  DEBUG: true
```

---

## 📚 さらに詳しく

詳細なガイドは以下を参照：

- [CICD_SETUP.md](./.github/CICD_SETUP.md) - 完全なセットアップガイド
- [test/README.md](./test/README.md) - テストガイド
- [URL_REWRITE_GUIDE.md](./URL_REWRITE_GUIDE.md) - URL書き換え設定

---

## ✅ チェックリスト

デプロイ前に確認：

- [ ] GitHub Secretsが設定されている
- [ ] AWS IAMユーザーの権限が正しい
- [ ] ワークフローファイルがコミットされている
- [ ] テストがローカルで成功している
- [ ] .gitignore が適切に設定されている

デプロイ後に確認：

- [ ] CI/CDワークフローが成功している
- [ ] ALBが正常に動作している
- [ ] ターゲットグループがHealthy
- [ ] 統合テストが成功している

---

## 🎉 完了！

これでGitHub Actionsによる自動デプロイが有効になりました。

変更をプッシュするだけで、自動的にテストとデプロイが実行されます！
