#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkResourcesStack } from './cdk-resources-stack';

const app = new cdk.App();

new CdkResourcesStack(app, 'aws-iam-example-reproduce-invalid-grant');
