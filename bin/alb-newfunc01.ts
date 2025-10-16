#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AlbNewfuncStack } from '../lib/alb-newfunc-stack';

const app = new cdk.App();
new AlbNewfuncStack(app, 'AlbNewfuncStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
    },
});