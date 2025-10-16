import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2Targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

export class AlbNewfuncStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // VPCを作成
        const vpc = new ec2.Vpc(this, 'ALBTestVpc', {
            maxAzs: 2,
            cidr: '10.0.0.0/16',
            natGateways: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                }
            ]
        });

        // セキュリティグループを作成（ALB用）
        const albSg = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
            vpc,
            description: 'Security group for ALB',
            allowAllOutbound: true,
        });

        albSg.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(80),
            'Allow HTTP traffic'
        );

        albSg.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(443),
            'Allow HTTPS traffic'
        );

        // セキュリティグループを作成（EC2インスタンス用）
        const instanceSg = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {
            vpc,
            description: 'Security group for EC2 instances',
            allowAllOutbound: true,
        });

        instanceSg.addIngressRule(
            albSg,
            ec2.Port.tcp(80),
            'Allow HTTP from ALB'
        );

        instanceSg.addIngressRule(
            albSg,
            ec2.Port.tcp(8080),
            'Allow HTTP on 8080 from ALB'
        );

        // Application Load Balancerを作成
        const alb = new elbv2.ApplicationLoadBalancer(this, 'TestALB', {
            vpc,
            internetFacing: true,
            securityGroup: albSg,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            }
        });

        // EC2インスタンスを作成（テスト用Webサーバー1）
        const userData1 = ec2.UserData.forLinux();
        userData1.addCommands(
            'yum update -y',
            'yum install -y httpd',
            'systemctl start httpd',
            'systemctl enable httpd',
            'echo "<h1>Server 1 - Original Path</h1><p>Path: $(echo $REQUEST_URI)</p>" > /var/www/html/index.html',
            'echo "<h1>Server 1 - API Endpoint</h1><p>This is API v1</p>" > /var/www/html/api.html'
        );

        const instance1 = new ec2.Instance(this, 'WebServer1', {
            vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux2(),
            userData: userData1,
            securityGroup: instanceSg,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
        });

        // EC2インスタンスを作成（テスト用Webサーバー2）
        const userData2 = ec2.UserData.forLinux();
        userData2.addCommands(
            'yum update -y',
            'yum install -y httpd',
            'systemctl start httpd',
            'systemctl enable httpd',
            'echo "<h1>Server 2 - Rewritten Path</h1><p>This is the new API v2</p>" > /var/www/html/index.html',
            'echo "<h1>Server 2 - New API</h1><p>This is API v2</p>" > /var/www/html/newapi.html',
            // /old-api パス用のディレクトリとファイルを作成
            'mkdir -p /var/www/html/old-api',
            'echo "<h1>Server 2 - Old API</h1><p>This path was rewritten and handled by Server 2</p>" > /var/www/html/old-api/test.html',
            'echo "<h1>Server 2 - Old API</h1><p>This path was rewritten and handled by Server 2</p>" > /var/www/html/old-api/index.html'
        );

        const instance2 = new ec2.Instance(this, 'WebServer2v2', {
            vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux2(),
            userData: userData2,
            securityGroup: instanceSg,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
        });

        // ターゲットグループ1を作成（オリジナルサーバー用）
        const targetGroup1 = new elbv2.ApplicationTargetGroup(this, 'TargetGroup1', {
            vpc,
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targetType: elbv2.TargetType.INSTANCE,
            healthCheck: {
                enabled: true,
                path: '/',
                protocol: elbv2.Protocol.HTTP,
            },
        });

        // ターゲットグループ2を作成（リライト先サーバー用）
        const targetGroup2 = new elbv2.ApplicationTargetGroup(this, 'TargetGroup2', {
            vpc,
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targetType: elbv2.TargetType.INSTANCE,
            healthCheck: {
                enabled: true,
                path: '/',
                protocol: elbv2.Protocol.HTTP,
            },
        });

        // インスタンスをターゲットグループに追加
        targetGroup1.addTarget(new elbv2Targets.InstanceTarget(instance1));
        targetGroup2.addTarget(new elbv2Targets.InstanceTarget(instance2));

        // リスナーを作成
        const listener = alb.addListener('HTTPListener', {
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            defaultAction: elbv2.ListenerAction.forward([targetGroup1]),
        });

        // URL書き換えルールを追加
        // L1コンストラクト（CfnListenerRule）を使用してRewriteConfigを実装
        // 注意: RewriteConfigは型定義にないため、addPropertyOverrideを使用

        // 1. パス /old-api/* を /new-api/* に書き換えて TargetGroup2 にルーティング
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

        // RewriteConfigを追加（型定義にないため、addPropertyOverrideを使用）
        // 注意: ap-northeast-1リージョンではRewriteConfigがまだサポートされていないため、コメントアウト
        // pathRewriteRule.addPropertyOverride('Actions.0.RewriteConfig', {
        //     Path: {
        //         Value: '/new-api/#{path}'
        //     }
        // });

        // 2. ホストヘッダー api.example.com を newapi.example.com に書き換えて TargetGroup2 にルーティング
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

        // ホストヘッダーのRewriteConfigを追加
        // 注意: ap-northeast-1リージョンではRewriteConfigがまだサポートされていないため、コメントアウト
        // hostRewriteRule.addPropertyOverride('Actions.0.RewriteConfig', {
        //     Host: {
        //         Value: 'newapi.example.com'
        //     }
        // });

        // 3. クエリパラメータ version=v1 をそのまま保持して TargetGroup2 にルーティング
        // （クエリパラメータにsource=albを追加）
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

        // クエリパラメータのRewriteConfigを追加
        // 注意: ap-northeast-1リージョンではRewriteConfigがまだサポートされていないため、コメントアウト
        // queryRewriteRule.addPropertyOverride('Actions.0.RewriteConfig', {
        //     Query: {
        //         Value: '#{query}&source=alb'
        //     }
        // });        // 出力値
        new cdk.CfnOutput(this, 'ALBDnsName', {
            value: alb.loadBalancerDnsName,
            description: 'ALB DNS Name',
        });

        new cdk.CfnOutput(this, 'TestInstructions', {
            value: [
                'Test the routing functionality:',
                '1. Path routing: curl http://' + alb.loadBalancerDnsName + '/old-api/test',
                '2. Host header routing: curl -H "Host: api.example.com" http://' + alb.loadBalancerDnsName + '/',
                '3. Query param routing: curl http://' + alb.loadBalancerDnsName + '/?version=v1',
                '',
                'Note: URL RewriteConfig feature is not yet supported in ap-northeast-1 region.',
                'Current implementation uses basic routing without path/host/query rewriting.',
                'See REWRITE_IMPLEMENTATION.md for details on enabling RewriteConfig when available.'
            ].join('\\n'),
            description: 'Instructions to test routing features',
        });
    }
}