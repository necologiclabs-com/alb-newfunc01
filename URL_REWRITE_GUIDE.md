# URL書き換え機能の実装ガイド

## 概要

このガイドでは、AWS ALBのURL書き換え機能を手動でCloudFormationテンプレートに追加する方法を説明します。
現在、CDKのTypeScript型定義が完全にURL書き換え機能をサポートしていないため、デプロイ後にCloudFormationテンプレートを手動で更新する必要があります。

## URL書き換え機能とは

AWS ALBのURL書き換え機能を使用すると、リスナールールにおいて以下の書き換えが可能になります：

1. **パスの書き換え**: リクエストパスを別のパスに書き換え
2. **ホストヘッダーの書き換え**: ホストヘッダーを別の値に書き換え
3. **クエリパラメータの書き換え**: クエリ文字列を書き換え

## 手動実装手順

### 方法1: AWS CLIを使用

デプロイ後、以下のコマンドでリスナールールを更新できます：

```bash
# リスナールールのARNを取得
aws elbv2 describe-rules --listener-arn <LISTENER_ARN>

# パス書き換えルールの更新
aws elbv2 modify-rule \
  --rule-arn <RULE_ARN> \
  --actions '[{
    "Type": "forward",
    "ForwardConfig": {
      "TargetGroups": [{
        "TargetGroupArn": "<TARGET_GROUP_ARN>",
        "Weight": 100
      }]
    },
    "RewriteConfig": {
      "Path": {
        "Value": "/new-api/#{path}"
      }
    }
  }]'

# ホストヘッダー書き換えルールの更新
aws elbv2 modify-rule \
  --rule-arn <RULE_ARN> \
  --actions '[{
    "Type": "forward",
    "ForwardConfig": {
      "TargetGroups": [{
        "TargetGroupArn": "<TARGET_GROUP_ARN>",
        "Weight": 100
      }]
    },
    "RewriteConfig": {
      "Host": {
        "Value": "newapi.example.com"
      }
    }
  }]'

# クエリパラメータ書き換えルールの更新
aws elbv2 modify-rule \
  --rule-arn <RULE_ARN> \
  --actions '[{
    "Type": "forward",
    "ForwardConfig": {
      "TargetGroups": [{
        "TargetGroupArn": "<TARGET_GROUP_ARN>",
        "Weight": 100
      }]
    },
    "RewriteConfig": {
      "Query": {
        "Value": "version=v2&source=rewritten"
      }
    }
  }]'
```

### 方法2: CloudFormationテンプレートを直接編集

1. CDKでスタックをシンセサイズ：
```bash
npx cdk synth > template.yaml
```

2. 生成された`template.yaml`を編集して、リスナールールに`RewriteConfig`を追加：

```yaml
OldApiPathRule:
  Type: AWS::ElasticLoadBalancingV2::ListenerRule
  Properties:
    Actions:
      - Type: forward
        ForwardConfig:
          TargetGroups:
            - TargetGroupArn: !Ref TargetGroup2
              Weight: 100
        # URL書き換え設定を追加
        RewriteConfig:
          Path:
            Value: '/new-api/#{path}'
    Conditions:
      - Field: path-pattern
        Values:
          - '/old-api/*'
    ListenerArn: !Ref HTTPListener
    Priority: 100
```

3. 編集したテンプレートを使用してデプロイ：
```bash
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name AlbNewfuncStack \
  --capabilities CAPABILITY_IAM
```

### 方法3: AWS Consoleを使用

1. AWS Management Consoleにログイン
2. EC2 > Load Balancers > 作成したALBを選択
3. Listeners タブから HTTP:80 を選択
4. Rules を表示
5. 各ルールを編集して、THEN セクションに Rewrite configuration を追加

## RewriteConfig の構文

### パス書き換え
```json
"RewriteConfig": {
  "Path": {
    "Value": "/new-api/#{path}"
  }
}
```

使用可能な変数：
- `#{path}`: リクエストパス全体
- `#{protocol}`: プロトコル（http/https）
- `#{host}`: ホスト名
- `#{port}`: ポート番号
- `#{query}`: クエリ文字列

### ホストヘッダー書き換え
```json
"RewriteConfig": {
  "Host": {
    "Value": "newapi.example.com"
  }
}
```

### クエリパラメータ書き換え
```json
"RewriteConfig": {
  "Query": {
    "Value": "version=v2&source=rewritten"
  }
}
```

### 複合書き換え
```json
"RewriteConfig": {
  "Path": {
    "Value": "/api/v2/#{path}"
  },
  "Host": {
    "Value": "newapi.example.com"
  },
  "Query": {
    "Value": "source=rewritten&#{query}"
  }
}
```

## 検証方法

書き換えルールを設定後、以下のコマンドで検証：

```bash
# ALB DNS名を取得
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name AlbNewfuncStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ALBDnsName`].OutputValue' \
  --output text)

# パス書き換えのテスト
curl -v "http://${ALB_DNS}/old-api/test"

# ホストヘッダー書き換えのテスト
curl -v -H "Host: api.example.com" "http://${ALB_DNS}/"

# クエリパラメータ書き換えのテスト
curl -v "http://${ALB_DNS}/?version=v1"
```

## 参考資料

- [AWS Blog: Introducing URL and Host Header Rewrite with AWS Application Load Balancers](https://aws.amazon.com/jp/blogs/networking-and-content-delivery/introducing-url-and-host-header-rewrite-with-aws-application-load-balancers/)
- [ALB Listener Rules - AWS Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-update-rules.html)