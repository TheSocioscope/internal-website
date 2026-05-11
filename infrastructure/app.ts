import * as cdk from 'aws-cdk-lib'
import * as fs from 'fs'
import * as path from 'path'
import { SocioscopeStack } from './stack'

const allowedEmails: string[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../allowed-emails.json'), 'utf8')
)

const app = new cdk.App()

new SocioscopeStack(app, 'SocioscopeStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-1',
  },
  allowedEmails,
  frontendUrl: process.env.FRONTEND_URL ?? 'https://socioscope.github.io',
})
