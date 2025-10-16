# テストガイド

このプロジェクトには、ユニットテストと統合テストが含まれています。

## テストの種類

### 1. ユニットテスト (`test/alb-newfunc-stack.test.ts`)

CDKスタックのCloudFormationテンプレートを検証します。デプロイは不要です。

**テスト内容:**
- VPCの作成確認
- サブネット数とタイプの検証
- セキュリティグループの設定確認
- ALBの設定検証
- ターゲットグループの構成確認
- EC2インスタンスの設定確認
- リスナールールの検証
- 出力値の確認

### 2. 統合テスト (`test/integration.test.ts`)

実際にデプロイされたALBに対してHTTPリクエストを送信し、ルーティング動作を検証します。

**テスト内容:**
- デフォルトルートのテスト
- パスベースルーティングのテスト
- ホストヘッダールーティングのテスト
- クエリパラメータルーティングのテスト
- ヘルスチェックの確認

## テストの実行方法

### 前提条件

```powershell
# 依存関係のインストール
npm install

# プロジェクトのビルド
npm run build
```

### ユニットテストのみ実行

```powershell
npm run test:unit
```

または

```powershell
npm test
```

**出力例:**
```
PASS  test/alb-newfunc-stack.test.ts
  AlbNewfuncStack
    VPC
      ✓ VPC should be created (50 ms)
      ✓ VPC should have correct CIDR block (10 ms)
      ✓ Should have 2 public subnets (15 ms)
      ✓ Should have 2 private subnets (12 ms)
    ...
    
Test Suites: 1 passed, 1 total
Tests:       30 passed, 30 total
```

### 統合テストのみ実行

⚠️ **重要**: 統合テストの実行前にスタックをデプロイする必要があります。

```powershell
# 1. スタックをデプロイ
npx cdk deploy

# 2. 統合テストを実行
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

✅ Path routing: /old-api/test (Server 2)
   Status: PASSED
   Duration: 189ms

✅ Host header routing: api.example.com (Server 2)
   Status: PASSED
   Duration: 201ms

✅ Query parameter routing: version=v1 (Server 2)
   Status: PASSED
   Duration: 195ms

✅ Different query parameter: version=v2 (Server 1)
   Status: PASSED
   Duration: 187ms

✅ ALB health check
   Status: PASSED
   Duration: 156ms

========================================

✨ Tests completed: 6 passed, 0 failed

🎉 All tests passed!
```

### すべてのテストを実行

```powershell
# ユニットテスト + 統合テスト
npm run test:all
```

## テストのカスタマイズ

### ユニットテストの追加

`test/alb-newfunc-stack.test.ts`にテストケースを追加できます：

```typescript
test('My custom test', () => {
  template.hasResourceProperties('AWS::EC2::Instance', {
    InstanceType: 't3.micro',
    // 追加の検証条件
  });
});
```

### 統合テストのカスタマイズ

`test/integration.test.ts`の`runIntegrationTests()`関数内にテストケースを追加できます：

```typescript
results.push(
  await runTest('Custom test', async () => {
    const response = await makeRequest(`${baseUrl}/custom-path`);
    if (response.statusCode !== 200) {
      throw new Error('Test failed');
    }
  })
);
```

## トラブルシューティング

### ユニットテストが失敗する場合

1. **ビルドエラー**
   ```powershell
   npm run build
   ```
   エラーがあれば修正してください。

2. **型エラー**
   ```powershell
   npm install
   ```
   依存関係を再インストールしてください。

### 統合テストが失敗する場合

1. **スタックがデプロイされていない**
   ```
   Error: Failed to get ALB DNS name
   ```
   → `npx cdk deploy`でデプロイしてください。

2. **タイムアウトエラー**
   ```
   Error: Request timeout
   ```
   → EC2インスタンスが起動中の可能性があります。数分待ってから再実行してください。

3. **ターゲットがUnhealthy**
   ```
   Error: Unhealthy status: 503
   ```
   → AWSコンソールでターゲットグループのヘルスステータスを確認してください。

4. **AWS認証エラー**
   ```
   Error: Unable to locate credentials
   ```
   → AWS CLIの認証情報を設定してください：
   ```powershell
   aws configure
   ```

## CI/CDへの統合

### GitHub Actions例

```yaml
name: Test

on: [push, pull_request]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
      - run: npm run test:unit

  integration-test:
    runs-on: ubuntu-latest
    needs: unit-test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
      - run: npm install
      - run: npm run build
      - run: npx cdk deploy --require-approval never
      - run: npm run test:integration
      - run: npx cdk destroy --force
        if: always()
```

## テストカバレッジの確認

```powershell
npm test -- --coverage
```

カバレッジレポートは `coverage/` ディレクトリに生成されます。

## ベストプラクティス

1. **ユニットテストを先に実行** - デプロイ前に基本的な検証を行う
2. **統合テストは定期的に** - デプロイ後の動作確認として実行
3. **テストの独立性** - 各テストは他のテストに依存しないようにする
4. **タイムアウト設定** - 長時間かかるテストにはタイムアウトを設定する
5. **クリーンアップ** - テスト後は必要に応じてリソースを削除する

## 参考資料

- [CDK Assertions](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions-readme.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/welcome.html)