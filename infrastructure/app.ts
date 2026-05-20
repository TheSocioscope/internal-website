import * as cdk from 'aws-cdk-lib'
import { SocioscopeStack } from './stack'

const app = new cdk.App()

new SocioscopeStack(app, 'SocioscopeStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-3',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'https://thesocioscope.github.io',
})
