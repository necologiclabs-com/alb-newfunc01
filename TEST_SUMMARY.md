# テストコード概要

## 作成されたテストファイル

### 1. **ユニットテスト** (`test/alb-newfunc-stack.test.ts`)

CDKスタックのCloudFormationテンプレートを検証する33のテストケース。

#### テストカテゴリー:

**VPC (6テスト)**
- ✅ VPC作成の確認
- ✅ CIDR ブロックの検証 (10.0.0.0/16)
- ✅ パブリックサブネット数 (2個)
- ✅ プライベートサブネット数 (2個)
- ✅ NAT Gateway の存在確認
- ✅ Internet Gateway の存在確認

**セキュリティグループ (3テスト)**
- ✅ ALB セキュリティグループの作成
- ✅ EC2 インスタンス セキュリティグループの作成
- ✅ セキュリティグループ数の確認

**Application Load Balancer (4テスト)**
- ✅ ALB の作成確認
- ✅ Internet-facing の設定確認
- ✅ HTTP リスナーの設定 (ポート80)
- ✅ デフォルトアクションの確認

**ターゲットグループ (3テスト)**
- ✅ 2つのターゲットグループの作成
- ✅ HTTP プロトコル、ポート80の確認
- ✅ ヘルスチェック設定の確認

**EC2インスタンス (4テスト)**
- ✅ 2つのEC2インスタンスの作成
- ✅ インスタンスタイプ (t3.micro) の確認
- ✅ プライベートサブネット配置の確認
- ✅ UserData の存在確認

**リスナールール (5テスト)**
- ✅ パスベースルーティングルール (優先度100)
- ✅ ホストヘッダールーティングルール (優先度200)
- ✅ クエリパラメータルーティングルール (優先度300)
- ✅ リスナールール数 (3個)
- ✅ すべてのルールがforward アクションを持つことの確認

**出力値 (2テスト)**
- ✅ ALB DNS 名の出力
- ✅ テスト手順の出力

**その他 (6テスト)**
- ✅ スタックのタグ対応
- ✅ リソース総数の検証
- ✅ IAM ロールの作成確認
- ✅ ALB とターゲットグループの参照整合性
- ✅ リスナールールとターゲットグループの参照整合性
- ✅ セキュリティグループ参照の整合性

---

### 2. **統合テスト** (`test/integration.test.ts`)

実際にデプロイされたALBに対してHTTPリクエストを送信する6つのテストシナリオ。

#### テストシナリオ:

1. **デフォルトルート (Server 1へ)**
   - URL: `http://<ALB_DNS>/`
   - 期待結果: Server 1 からの応答

2. **パスルーティング (Server 2へ)**
   - URL: `http://<ALB_DNS>/old-api/test`
   - 期待結果: Server 2 へルーティング

3. **ホストヘッダールーティング (Server 2へ)**
   - URL: `http://<ALB_DNS>/`
   - ヘッダー: `Host: api.example.com`
   - 期待結果: Server 2 へルーティング

4. **クエリパラメータルーティング (Server 2へ)**
   - URL: `http://<ALB_DNS>/?version=v1`
   - 期待結果: Server 2 へルーティング

5. **異なるクエリパラメータ (Server 1へ)**
   - URL: `http://<ALB_DNS>/?version=v2`
   - 期待結果: Server 1 からの応答

6. **ALB ヘルスチェック**
   - URL: `http://<ALB_DNS>/`
   - 期待結果: 正常なHTTPステータスコード

---

### 3. **テスト設定ファイル**

#### `jest.config.js`
- テスト環境: Node.js
- テストパターン: `**/*.test.ts`
- トランスフォーマー: ts-jest

---

## テストの実行方法

### すべてのユニットテストを実行
```powershell
npm run test:unit
```

**出力例:**
```
PASS  test/alb-newfunc-stack.test.ts
  AlbNewfuncStack
    ✓ VPC should be created
    ✓ VPC should have correct CIDR block
    ✓ Should have 2 public subnets
    ...

Test Suites: 1 passed, 1 total
Tests:       33 passed, 33 total
Time:        8.675 s
```

### 統合テストを実行（デプロイ後）
```powershell
npm run test:integration
```

**出力例:**
```
🚀 Starting ALB Integration Tests
========================================
📍 Getting ALB DNS name from CloudFormation...
✅ ALB DNS: AlbNewfu-TestA-xxxxx.ap-northeast-1.elb.amazonaws.com

========================================
📊 Test Results

✅ Default route (Server 1)
   Status: PASSED
   Duration: 234ms
...

✨ Tests completed: 6 passed, 0 failed
🎉 All tests passed!
```

### すべてのテストを実行
```powershell
npm run test:all
```

---

## テストコードの特徴

### ユニットテスト
- ✅ **高速**: デプロイ不要で数秒で完了
- ✅ **包括的**: 33のテストケースで主要リソースを検証
- ✅ **CI/CD対応**: GitHub Actions などで自動実行可能
- ✅ **早期検出**: デプロイ前に設定ミスを発見

### 統合テスト
- ✅ **実環境検証**: 実際のALBの動作を確認
- ✅ **ルーティング検証**: 3つのルーティングパターンをテスト
- ✅ **詳細な出力**: 各テストの結果と実行時間を表示
- ✅ **エラーハンドリング**: タイムアウトや接続エラーに対応

---

## テストのベストプラクティス

1. **開発サイクル**
   ```
   コード変更 → ビルド → ユニットテスト → デプロイ → 統合テスト
   ```

2. **CI/CDパイプライン**
   - プルリクエスト時: ユニットテストを実行
   - マージ後: デプロイ → 統合テストを実行
   - 定期実行: 統合テストで環境の健全性を確認

3. **テスト追加**
   - 新機能追加時は必ず対応するテストも追加
   - バグ修正時は再発防止のためのテストを追加

---

## トラブルシューティング

### ユニットテストが失敗する場合
```powershell
# ビルドエラーを確認
npm run build

# 依存関係を再インストール
npm install
```

### 統合テストが失敗する場合
```powershell
# スタックの状態を確認
npx cdk diff

# ターゲットグループのヘルスチェックを確認
aws elbv2 describe-target-health --target-group-arn <ARN>

# ALBログの確認
aws logs tail /aws/elasticloadbalancing/app/<ALB-NAME> --follow
```

---

## テストカバレッジ

現在のテストカバレッジ:

| カテゴリ | ユニットテスト | 統合テスト |
|---------|:-------------:|:----------:|
| VPC | ✅ | - |
| セキュリティグループ | ✅ | - |
| ALB | ✅ | ✅ |
| ターゲットグループ | ✅ | - |
| EC2インスタンス | ✅ | - |
| リスナールール | ✅ | ✅ |
| ルーティング動作 | - | ✅ |
| ヘルスチェック | ✅ | ✅ |

**総テスト数**: 39テスト (ユニット: 33, 統合: 6)

---

## 今後の拡張案

- [ ] URL書き換え機能のテスト追加
- [ ] パフォーマンステスト (負荷テスト)
- [ ] HTTPS テスト
- [ ] カスタムエラーページのテスト
- [ ] スティッキーセッションのテスト
- [ ] WebSocket接続のテスト

---

詳細は各テストファイルのコメントを参照してください。
