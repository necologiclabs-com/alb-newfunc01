# ALB URL/ホストヘッダー書き換え機能の実装

## 📋 概要

このプロジェクトでは、AWS ALBの新機能である**URL/ホストヘッダー書き換え機能**をCDKで実装しています。

公式ブログ: [Introducing URL and Host Header Rewrite with AWS Application Load Balancers](https://aws.amazon.com/jp/blogs/networking-and-content-delivery/introducing-url-and-host-header-rewrite-with-aws-application-load-balancers/)

---

## 🔧 実装方法

### 問題
CDKのTypeScript型定義は、まだ`RewriteConfig`プロパティを完全にサポートしていません。

### 解決策
`CfnListenerRule`（L1コンストラクト）と`addPropertyOverride`メソッドを使用して、CloudFormationテンプレートに直接`RewriteConfig`を追加します。

---

## 💻 実装コード

### 1. パス書き換え (`/old-api/*` → `/new-api/*`)

```typescript
// L1コンストラクトでリスナールールを作成
const pathRewriteRule = new elbv2.CfnListenerRule(this, 'OldApiPathRewriteRule', {
    listenerArn: listener.listenerArn,
    priority: 100,
    conditions: [
        {
            field: 'path-pattern',
            pathPatternConfig: {
                values: ['/old-api/*']
            }
        }
    ],
    actions: [
        {
            type: 'forward',
            targetGroupArn: targetGroup2.targetGroupArn,
            forwardConfig: {
                targetGroups: [
                    {
                        targetGroupArn: targetGroup2.targetGroupArn,
                        weight: 1
                    }
                ]
            }
        }
    ]
});

// RewriteConfigをプロパティオーバーライドで追加
pathRewriteRule.addPropertyOverride('Actions.0.RewriteConfig', {
    Path: {
        Value: '/new-api/#{path}'
    }
});
```

**動作:**
- リクエスト: `GET /old-api/test`
- 書き換え後: `GET /new-api/old-api/test`
- バックエンドに転送されるパス: `/new-api/old-api/test`

---

### 2. ホストヘッダー書き換え (`api.example.com` → `newapi.example.com`)

```typescript
const hostRewriteRule = new elbv2.CfnListenerRule(this, 'ApiHostRewriteRule', {
    listenerArn: listener.listenerArn,
    priority: 200,
    conditions: [
        {
            field: 'host-header',
            hostHeaderConfig: {
                values: ['api.example.com']
            }
        }
    ],
    actions: [
        {
            type: 'forward',
            targetGroupArn: targetGroup2.targetGroupArn,
            forwardConfig: {
                targetGroups: [
                    {
                        targetGroupArn: targetGroup2.targetGroupArn,
                        weight: 1
                    }
                ]
            }
        }
    ]
});

// ホストヘッダーのRewriteConfig
hostRewriteRule.addPropertyOverride('Actions.0.RewriteConfig', {
    Host: {
        Value: 'newapi.example.com'
    }
});
```

**動作:**
- リクエスト: `Host: api.example.com`
- 書き換え後: `Host: newapi.example.com`
- バックエンドに転送されるホスト: `newapi.example.com`

---

### 3. クエリパラメータ書き換え（`source=alb`を追加）

```typescript
const queryRewriteRule = new elbv2.CfnListenerRule(this, 'VersionQueryRewriteRule', {
    listenerArn: listener.listenerArn,
    priority: 300,
    conditions: [
        {
            field: 'query-string',
            queryStringConfig: {
                values: [
                    {
                        key: 'version',
                        value: 'v1'
                    }
                ]
            }
        }
    ],
    actions: [
        {
            type: 'forward',
            targetGroupArn: targetGroup2.targetGroupArn,
            forwardConfig: {
                targetGroups: [
                    {
                        targetGroupArn: targetGroup2.targetGroupArn,
                        weight: 1
                    }
                ]
            }
        }
    ]
});

// クエリパラメータのRewriteConfig
queryRewriteRule.addPropertyOverride('Actions.0.RewriteConfig', {
    Query: {
        Value: '#{query}&source=alb'
    }
});
```

**動作:**
- リクエスト: `GET /?version=v1`
- 書き換え後: `GET /?version=v1&source=alb`
- バックエンドに転送されるクエリ: `version=v1&source=alb`

---

## 📊 生成されるCloudFormationテンプレート

```yaml
OldApiPathRewriteRule:
  Type: AWS::ElasticLoadBalancingV2::ListenerRule
  Properties:
    Actions:
      - ForwardConfig:
          TargetGroups:
            - TargetGroupArn: !Ref TargetGroup2
              Weight: 1
        TargetGroupArn: !Ref TargetGroup2
        Type: forward
        RewriteConfig:           # ← addPropertyOverrideで追加
          Path:
            Value: /new-api/#{path}
    Conditions:
      - Field: path-pattern
        PathPatternConfig:
          Values:
            - /old-api/*
    ListenerArn: !Ref HTTPListener
    Priority: 100
```

---

## 🧪 テスト方法

### デプロイ前の確認
```bash
# CloudFormationテンプレートを生成してRewriteConfigを確認
npx cdk synth | grep -A5 RewriteConfig
```

### デプロイ
```bash
# ローカルから
npx cdk deploy --profile yucho-dev

# または GitHub Actions経由
git push origin main
```

### 動作確認
```bash
# ALB DNS名を取得
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name AlbNewfuncStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ALBDnsName`].OutputValue' \
  --output text \
  --profile yucho-dev)

# 1. パス書き換えのテスト
curl -v "http://${ALB_DNS}/old-api/test" 2>&1 | grep -E "GET|X-Forwarded"

# 2. ホストヘッダー書き換えのテスト
curl -v -H "Host: api.example.com" "http://${ALB_DNS}/" 2>&1 | grep -E "Host|X-Forwarded"

# 3. クエリパラメータ書き換えのテスト
curl -v "http://${ALB_DNS}/?version=v1" 2>&1 | grep -E "GET|source=alb"
```

---

## 🔍 書き換えの確認方法

バックエンドサーバー（EC2）で受信したリクエストを確認するには、Apacheのアクセスログを参照します：

```bash
# EC2にSSH接続（または Systems Manager Session Manager）
sudo tail -f /var/log/httpd/access_log
```

または、EC2のUserDataでカスタムログを追加：

```typescript
userData2.addCommands(
    'mkdir -p /var/www/cgi-bin',
    'cat > /var/www/cgi-bin/debug.sh << "EOF"',
    '#!/bin/bash',
    'echo "Content-Type: text/plain"',
    'echo ""',
    'echo "Request URI: $REQUEST_URI"',
    'echo "Query String: $QUERY_STRING"',
    'echo "Host: $HTTP_HOST"',
    'EOF',
    'chmod +x /var/www/cgi-bin/debug.sh'
);
```

---

## 📚 RewriteConfig で使用可能な変数

| 変数 | 説明 | 例 |
|------|------|-----|
| `#{protocol}` | プロトコル | `http` または `https` |
| `#{host}` | ホスト名 | `example.com` |
| `#{port}` | ポート番号 | `80` または `443` |
| `#{path}` | リクエストパス | `/api/users` |
| `#{query}` | クエリ文字列 | `id=123&name=test` |

### 使用例

```typescript
// 複合的な書き換え
addPropertyOverride('Actions.0.RewriteConfig', {
    Path: {
        Value: '/v2#{path}'                    // /api/users → /v2/api/users
    },
    Host: {
        Value: 'api.#{host}'                   // example.com → api.example.com
    },
    Query: {
        Value: '#{query}&source=alb'           // id=123 → id=123&source=alb
    }
});
```

---

## ⚠️ 注意事項

### 1. **型定義の制限**
CDKのTypeScript型定義は`RewriteConfig`をサポートしていないため、IDEの型チェックは効きません。

### 2. **CloudFormationテンプレートの検証**
必ず`npx cdk synth`で生成されたテンプレートを確認してください。

### 3. **既存のルールとの競合**
優先度（Priority）が重複しないように注意してください。

### 4. **パス書き換えの挙動**
- `/old-api/test` → `/new-api/old-api/test` (パス全体が変数として展開される)
- 完全な置換が必要な場合は、バックエンドでさらに処理が必要

---

## 🎯 実装場所

| ファイル | 行数 | 内容 |
|---------|------|------|
| `lib/alb-newfunc-stack.ts` | 163-256 | リスナールールとRewriteConfigの実装 |
| `URL_REWRITE_GUIDE.md` | - | 手動実装ガイド（参考用） |
| `test-alb-detailed.ps1` | - | 動作確認スクリプト |

---

## ✅ まとめ

- ✅ CDK L1コンストラクト + `addPropertyOverride`で実装
- ✅ パス、ホストヘッダー、クエリパラメータの書き換えをサポート
- ✅ CloudFormationテンプレートに自動的に含まれる
- ✅ GitHub Actions CI/CDで自動デプロイ
- ✅ テストスクリプトで動作確認可能

---

**参考:** AWSの公式ブログ記事  
https://aws.amazon.com/jp/blogs/networking-and-content-delivery/introducing-url-and-host-header-rewrite-with-aws-application-load-balancers/
