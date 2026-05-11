import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import * as path from 'path'

interface SocioscopeStackProps extends cdk.StackProps {
  allowedEmails: string[]
  frontendUrl: string
}

export class SocioscopeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SocioscopeStackProps) {
    super(scope, id, props)

    // ── KMS Key for credentials encryption ────────────────────────────────────
    const credentialsKey = new kms.Key(this, 'CredentialsKey', {
      description: 'Encrypts Socioscope credentials at rest',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ── S3 Bucket ─────────────────────────────────────────────────────────────
    const bucket = new s3.Bucket(this, 'SocioscopeBucket', {
      bucketName: `socioscope-internal-${this.account}`,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{
        noncurrentVersionExpiration: cdk.Duration.days(365),
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
      }],
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
        allowedOrigins: [props.frontendUrl],
        allowedHeaders: ['*'],
        maxAge: 3000,
      }],
    })

    // ── DynamoDB Tables ───────────────────────────────────────────────────────
    const tableDefaults = {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    }

    const tables: Record<string, dynamodb.Table> = {}

    for (const name of [
      'announcements', 'links', 'tools', 'credentials',
      'resources', 'process_docs',
      'kanban_boards', 'kanban_columns', 'kanban_cards',
    ]) {
      tables[name] = new dynamodb.Table(this, `Table_${name}`, {
        tableName: `socioscope_${name}`,
        ...tableDefaults,
      })
    }

    const otpTable = new dynamodb.Table(this, 'OtpTokensTable', {
      tableName: 'socioscope_otp_tokens',
      partitionKey: { name: 'pendingToken', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // ── JWT Secret from SSM Parameter Store ───────────────────────────────────
    const jwtSecret = ssm.StringParameter.valueForStringParameter(
      this, '/socioscope/jwt-secret'
    )
    const gmailUser = ssm.StringParameter.valueForStringParameter(
      this, '/socioscope/gmail-user'
    )
    const gmailAppPassword = ssm.StringParameter.valueForStringParameter(
      this, '/socioscope/gmail-app-password'
    )

    // ── Lambda environment shared vars ────────────────────────────────────────
    const sharedEnv = {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      DYNAMODB_TABLE_PREFIX: 'socioscope_',
      S3_BUCKET: bucket.bucketName,
      FRONTEND_URL: props.frontendUrl,
      ALLOWED_EMAILS: JSON.stringify(props.allowedEmails.map(e => e.toLowerCase())),
      KMS_KEY_ID: credentialsKey.keyId,
      JWT_SECRET: jwtSecret,
      GMAIL_USER: gmailUser,
      GMAIL_APP_PASSWORD: gmailAppPassword,
    }

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: sharedEnv,
      logRetention: logs.RetentionDays.THREE_MONTHS,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    }

    // ── Lambda Functions ──────────────────────────────────────────────────────
    const authFn = new NodejsFunction(this, 'AuthFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../backend/auth/index.js'),
    })
    otpTable.grantReadWriteData(authFn)

    const filesFn = new NodejsFunction(this, 'FilesFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../backend/files/index.js'),
    })
    bucket.grantReadWrite(filesFn)

    // CRUD functions
    const crudFunctions: Record<string, NodejsFunction> = {}
    for (const [name, dir] of [
      ['announcements', 'announcements'],
      ['links', 'links'],
      ['tools', 'tools'],
      ['resources', 'resources'],
      ['process', 'process'],
    ] as [string, string][]) {
      const fn = new NodejsFunction(this, `${name}Fn`, {
        ...lambdaDefaults,
        entry: path.join(__dirname, `../backend/${dir}/index.js`),
      })
      const table = tables[name] ?? tables[`${name}_docs`]
      if (table) table.grantReadWriteData(fn)
      crudFunctions[name] = fn
    }

    const credentialsFn = new NodejsFunction(this, 'CredentialsFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../backend/credentials/index.js'),
    })
    tables['credentials'].grantReadWriteData(credentialsFn)
    credentialsKey.grantEncryptDecrypt(credentialsFn)

    const tasksFn = new NodejsFunction(this, 'TasksFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../backend/tasks/index.js'),
    })
    tables['kanban_boards'].grantReadWriteData(tasksFn)
    tables['kanban_columns'].grantReadWriteData(tasksFn)
    tables['kanban_cards'].grantReadWriteData(tasksFn)

    // ── API Gateway ───────────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'SocioscopeApi', {
      restApiName: 'Socioscope API',
      defaultCorsPreflightOptions: {
        allowOrigins: [props.frontendUrl],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Cookie'],
        allowCredentials: true,
      },
    })

    function addLambdaResource(apiPath: string, fn: NodejsFunction) {
      const parts = apiPath.split('/').filter(Boolean)
      let resource = api.root
      for (const part of parts) {
        const existing = resource.getResource(part)
        resource = existing ?? resource.addResource(part)
      }
      resource.addMethod('ANY', new apigateway.LambdaIntegration(fn))
      const proxy = resource.addResource('{proxy+}')
      proxy.addMethod('ANY', new apigateway.LambdaIntegration(fn))
    }

    addLambdaResource('/auth', authFn)
    addLambdaResource('/files', filesFn)
    addLambdaResource('/announcements', crudFunctions['announcements'])
    addLambdaResource('/links', crudFunctions['links'])
    addLambdaResource('/tools', crudFunctions['tools'])
    addLambdaResource('/resources', crudFunctions['resources'])
    addLambdaResource('/process', crudFunctions['process'])
    addLambdaResource('/credentials', credentialsFn)
    addLambdaResource('/boards', tasksFn)
    addLambdaResource('/columns', tasksFn)
    addLambdaResource('/cards', tasksFn)

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url })
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName })
    new cdk.CfnOutput(this, 'KmsKeyId', { value: credentialsKey.keyId })
  }
}
