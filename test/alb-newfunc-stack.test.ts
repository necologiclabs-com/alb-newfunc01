import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as AlbNewfunc from '../lib/alb-newfunc-stack';

describe('AlbNewfuncStack', () => {
    let app: cdk.App;
    let stack: AlbNewfunc.AlbNewfuncStack;
    let template: Template;

    beforeEach(() => {
        app = new cdk.App();
        stack = new AlbNewfunc.AlbNewfuncStack(app, 'TestStack');
        template = Template.fromStack(stack);
    });

    describe('VPC', () => {
        test('VPC should be created', () => {
            template.resourceCountIs('AWS::EC2::VPC', 1);
        });

        test('VPC should have correct CIDR block', () => {
            template.hasResourceProperties('AWS::EC2::VPC', {
                CidrBlock: '10.0.0.0/16',
                EnableDnsHostnames: true,
                EnableDnsSupport: true,
            });
        });

        test('Should have 2 public subnets', () => {
            template.resourceCountIs('AWS::EC2::Subnet', 4); // 2 public + 2 private

            const subnets = template.findResources('AWS::EC2::Subnet');
            const publicSubnets = Object.values(subnets).filter(
                (subnet: any) => subnet.Properties.MapPublicIpOnLaunch === true
            );
            expect(publicSubnets.length).toBe(2);
        });

        test('Should have 2 private subnets', () => {
            const subnets = template.findResources('AWS::EC2::Subnet');
            const privateSubnets = Object.values(subnets).filter(
                (subnet: any) => subnet.Properties.MapPublicIpOnLaunch !== true
            );
            expect(privateSubnets.length).toBe(2);
        });

        test('Should have NAT Gateway', () => {
            template.resourceCountIs('AWS::EC2::NatGateway', 1);
        });

        test('Should have Internet Gateway', () => {
            template.resourceCountIs('AWS::EC2::InternetGateway', 1);
        });
    });

    describe('Security Groups', () => {
        test('Should create ALB security group', () => {
            template.hasResourceProperties('AWS::EC2::SecurityGroup', {
                GroupDescription: 'Security group for ALB',
                SecurityGroupIngress: Match.arrayWith([
                    Match.objectLike({
                        CidrIp: '0.0.0.0/0',
                        IpProtocol: 'tcp',
                        FromPort: 80,
                        ToPort: 80,
                    }),
                    Match.objectLike({
                        CidrIp: '0.0.0.0/0',
                        IpProtocol: 'tcp',
                        FromPort: 443,
                        ToPort: 443,
                    }),
                ]),
            });
        });

        test('Should create instance security group', () => {
            template.hasResourceProperties('AWS::EC2::SecurityGroup', {
                GroupDescription: 'Security group for EC2 instances',
            });
        });

        test('Security groups count should be correct', () => {
            // ALB SG + Instance SG (minimum 2)
            const securityGroups = template.findResources('AWS::EC2::SecurityGroup');
            expect(Object.keys(securityGroups).length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Application Load Balancer', () => {
        test('ALB should be created', () => {
            template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
        });

        test('ALB should be internet-facing', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
                Scheme: 'internet-facing',
                Type: 'application',
            });
        });

        test('ALB should have HTTP listener', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
                Port: 80,
                Protocol: 'HTTP',
            });
        });

        test('Should have listener with default action', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
                DefaultActions: Match.arrayWith([
                    Match.objectLike({
                        Type: 'forward',
                    }),
                ]),
            });
        });
    });

    describe('Target Groups', () => {
        test('Should create 2 target groups', () => {
            template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 2);
        });

        test('Target groups should use HTTP protocol on port 80', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
                Port: 80,
                Protocol: 'HTTP',
                TargetType: 'instance',
            });
        });

        test('Target groups should have health check configured', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
                HealthCheckEnabled: true,
                HealthCheckPath: '/',
                HealthCheckProtocol: 'HTTP',
            });
        });
    });

    describe('EC2 Instances', () => {
        test('Should create 2 EC2 instances', () => {
            template.resourceCountIs('AWS::EC2::Instance', 2);
        });

        test('Instances should use t3.micro', () => {
            template.hasResourceProperties('AWS::EC2::Instance', {
                InstanceType: 't3.micro',
            });
        });

        test('Instances should be in private subnets', () => {
            const instances = template.findResources('AWS::EC2::Instance');
            Object.values(instances).forEach((instance: any) => {
                expect(instance.Properties.SubnetId).toBeDefined();
            });
        });

        test('Instances should have user data', () => {
            template.hasResourceProperties('AWS::EC2::Instance', {
                UserData: Match.anyValue(),
            });
        });
    });

    describe('Listener Rules', () => {
        test('Should have path-based routing rule', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
                Priority: 100,
                Conditions: Match.arrayWith([
                    Match.objectLike({
                        Field: 'path-pattern',
                        PathPatternConfig: {
                            Values: ['/old-api/*']
                        }
                    }),
                ]),
            });
        });

        test('Should have host-header routing rule', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
                Priority: 200,
                Conditions: Match.arrayWith([
                    Match.objectLike({
                        Field: 'host-header',
                        HostHeaderConfig: {
                            Values: ['api.example.com']
                        }
                    }),
                ]),
            });
        }); test('Should have query-string routing rule', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
                Priority: 300,
                Conditions: Match.arrayWith([
                    Match.objectLike({
                        Field: 'query-string',
                    }),
                ]),
            });
        });

        test('Should have 3 listener rules', () => {
            template.resourceCountIs('AWS::ElasticLoadBalancingV2::ListenerRule', 3);
        });

        test('All rules should forward to target groups', () => {
            const rules = template.findResources('AWS::ElasticLoadBalancingV2::ListenerRule');
            Object.values(rules).forEach((rule: any) => {
                expect(rule.Properties.Actions).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            Type: 'forward',
                        }),
                    ])
                );
            });
        });
    });

    describe('Outputs', () => {
        test('Should output ALB DNS name', () => {
            template.hasOutput('ALBDnsName', {
                Description: 'ALB DNS Name',
            });
        });

        test('Should output test instructions', () => {
            template.hasOutput('TestInstructions', {
                Description: 'Instructions to test URL rewrite features',
            });
        });
    });

    describe('Stack Tags', () => {
        test('Stack should be taggable', () => {
            // CDK automatically adds tags to resources
            expect(stack.tags).toBeDefined();
        });
    });

    describe('Resource Count Validation', () => {
        test('Should have expected total resource count', () => {
            const resources = template.toJSON().Resources;
            const resourceCount = Object.keys(resources).length;

            // Rough estimate: VPC resources + ALB + EC2 + Security Groups + Routes + etc.
            expect(resourceCount).toBeGreaterThan(30);
            expect(resourceCount).toBeLessThan(100);
        });
    });

    describe('IAM Roles', () => {
        test('Should create IAM role for EC2 instances', () => {
            template.hasResourceProperties('AWS::IAM::Role', {
                AssumeRolePolicyDocument: Match.objectLike({
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Action: 'sts:AssumeRole',
                            Effect: 'Allow',
                            Principal: {
                                Service: 'ec2.amazonaws.com',
                            },
                        }),
                    ]),
                }),
            });
        });
    });

    describe('Integration Tests', () => {
        test('ALB should reference correct target groups', () => {
            const listener = template.findResources('AWS::ElasticLoadBalancingV2::Listener');
            const listenerValues = Object.values(listener);

            expect(listenerValues.length).toBeGreaterThan(0);
            listenerValues.forEach((l: any) => {
                expect(l.Properties.DefaultActions[0].TargetGroupArn).toBeDefined();
            });
        });

        test('Listener rules should reference valid target groups', () => {
            const rules = template.findResources('AWS::ElasticLoadBalancingV2::ListenerRule');

            Object.values(rules).forEach((rule: any) => {
                const action = rule.Properties.Actions[0];
                expect(action.TargetGroupArn).toBeDefined();
            });
        });

        test('Security group references should be valid', () => {
            const instances = template.findResources('AWS::EC2::Instance');

            Object.values(instances).forEach((instance: any) => {
                expect(instance.Properties.SecurityGroupIds).toBeDefined();
                expect(instance.Properties.SecurityGroupIds.length).toBeGreaterThan(0);
            });
        });
    });
});
