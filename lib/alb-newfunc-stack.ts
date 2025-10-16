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
            'echo "<h1>Server 2 - New API</h1><p>This is API v2</p>" > /var/www/html/newapi.html'
        );

        const instance2 = new ec2.Instance(this, 'WebServer2', {
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
        // 注意：rewriteConfigはCloudFormationの新機能で、CDKのTypeScript定義がまだ完全でない可能性があります
        // そのため、基本的なルーティングルールとして実装し、後でCloudFormationテンプレートを手動調整します

        // 1. パス /old-api/* を TargetGroup2 にルーティング
        listener.addAction('OldApiPathRule', {
            priority: 100,
            conditions: [
                elbv2.ListenerCondition.pathPatterns(['/old-api/*'])
            ],
            action: elbv2.ListenerAction.forward([targetGroup2])
        });

        // 2. 特定のホストヘッダーをTargetGroup2にルーティング
        listener.addAction('ApiHostRule', {
            priority: 200,
            conditions: [
                elbv2.ListenerCondition.hostHeaders(['api.example.com'])
            ],
            action: elbv2.ListenerAction.forward([targetGroup2])
        });

        // 3. クエリパラメータ version=v1 をTargetGroup2にルーティング
        listener.addAction('VersionQueryRule', {
            priority: 300,
            conditions: [
                elbv2.ListenerCondition.queryStrings([{
                    key: 'version',
                    value: 'v1'
                }])
            ],
            action: elbv2.ListenerAction.forward([targetGroup2])
        });        // 出力値
        new cdk.CfnOutput(this, 'ALBDnsName', {
            value: alb.loadBalancerDnsName,
            description: 'ALB DNS Name',
        });

        new cdk.CfnOutput(this, 'TestInstructions', {
            value: [
                'Test the routing functionality:',
                '1. Path routing: http://' + alb.loadBalancerDnsName + '/old-api/test',
                '2. Host header routing: curl -H "Host: api.example.com" http://' + alb.loadBalancerDnsName + '/',
                '3. Query param routing: http://' + alb.loadBalancerDnsName + '/?version=v1',
                '',
                'Note: URL rewrite feature requires manual CloudFormation template update.',
                'After deployment, update the ListenerRules in CloudFormation console to add RewriteConfig.'
            ].join('\\n'),
            description: 'Instructions to test routing features',
        });
    }
}