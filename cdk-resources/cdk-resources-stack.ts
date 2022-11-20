import * as path from "path";

import { App, Stack, RemovalPolicy } from "aws-cdk-lib";
import {
  AccessLogFormat,
  AuthorizationType,
  Cors,
  LogGroupLogDestination,
  CognitoUserPoolsAuthorizer,
  LambdaIntegration,
  MethodLoggingLevel,
  ResponseType,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import {
  UserPool,
  ResourceServerScope,
  UserPoolDomain,
} from "aws-cdk-lib/aws-cognito";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

export class CdkResourcesStack extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: "ap-southeast-2",
      },
    });

    const cognitoDomainName = "reproduce-invalid-grant";
    const cognitoPool = this.setupCognitoPool(cognitoDomainName);
    const api = this.setupApiGateway(cognitoPool);
    this.setupUserClientLambda(cognitoPool);

    new StringParameter(this, "ssm-cognito-token-url", {
      parameterName: "/reproduce-aws-invalid-grant/cognito-token-url",
      stringValue: `https://${cognitoDomainName}.auth.ap-southeast-2.amazoncognito.com/oauth2/token`,
    });
    new StringParameter(this, "ssm-apigateway-url", {
      parameterName: "/reproduce-aws-invalid-grant/apigateway-url",
      stringValue: api.url,
    });
  }

  /**
   * Create the cognito pool
   */
  setupCognitoPool(domainPrefix: string) {
    const cognitoPool = new UserPool(this, "cognito-account-external", {
      userPoolName: "aws-reproduce-external-pool",
      selfSignUpEnabled: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    cognitoPool.addResourceServer("platform-resource-server", {
      identifier: "platform",
      userPoolResourceServerName: "Platform",
      scopes: this.transformScopes([["openid", "OpenID Access"]]),
    });
    cognitoPool.addResourceServer("accounts-resource-server", {
      identifier: "accounts",
      userPoolResourceServerName: "Accounts",
      scopes: this.transformScopes([
        ["read", "Read accounts resources"],
        ["write", "Write accounts resources"],
      ]),
    });

    new UserPoolDomain(this, "Domain", {
      userPool: cognitoPool,
      cognitoDomain: { domainPrefix },
    });

    return cognitoPool;
  }

  /**
   *
   * @param scopes
   * @returns
   */
  transformScopes(scopes: string[][]) {
    return scopes.map(
      ([scopeName, scopeDescription]) =>
        new ResourceServerScope({ scopeName, scopeDescription })
    );
  }

  /**
   *
   * @param cognitoPool
   */
  setupApiGateway(cognitoPool: UserPool) {
    // api access logs
    const logGroup = new LogGroup(
      this,
      `api-gateway-log-group-reproduce-invalid-grant`,
      {
        logGroupName: `/awsbugreproduce/apigateway/rest-api-reproduce-invalid-grant`,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    // rest api
    const restApi = new RestApi(this, `api-gateway-reproduce-iam-error`, {
      restApiName: `AWS Reproduce IAM error`,
      deployOptions: {
        metricsEnabled: true,
        tracingEnabled: true,
        dataTraceEnabled: true,
        loggingLevel: MethodLoggingLevel.OFF,
        accessLogDestination: new LogGroupLogDestination(logGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowHeaders: ["*"],
        allowMethods: Cors.ALL_METHODS,
      },
    });

    // add cors headers to default error responses
    restApi.addGatewayResponse("api-gateway-rest-default-4XX", {
      type: ResponseType.DEFAULT_4XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'*'",
      },
    });
    restApi.addGatewayResponse("api-gateway-rest-default-5XX", {
      type: ResponseType.DEFAULT_5XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'*'",
      },
    });

    const lambdaFunction = this.createLambda(
      "example-api",
      "api/example-protected-api-lambda.ts",
      { COGNITO_USER_POOL_ID: cognitoPool.userPoolId }
    );

    const lambdaIntegration = new LambdaIntegration(lambdaFunction, {
      requestTemplates: { "application/json": '{ "statusCode": "200" }' },
    });

    restApi.root.addMethod("POST", lambdaIntegration, {
      authorizationType: AuthorizationType.COGNITO,
      authorizationScopes: ["platform/openid"],
      authorizer: new CognitoUserPoolsAuthorizer(
        this,
        `cognito-userpool-authorizer-${path}`,
        {
          cognitoUserPools: [cognitoPool],
          authorizerName: "Authoriser",
        }
      ),
    });

    return restApi;
  }

  /**
   *
   * @param cognitoPool
   */
  setupUserClientLambda(cognitoPool: UserPool) {
    const createLambda = this.createLambda(
      "create-user",
      "users/create-user-client.ts",
      { COGNITO_USER_POOL_ID: cognitoPool.userPoolId }
    );
    const getLambda = this.createLambda(
      "get-user",
      "users/get-user-client.ts",
      { COGNITO_USER_POOL_ID: cognitoPool.userPoolId }
    );
    const deleteLambda = this.createLambda(
      "delete-user",
      "users/delete-user-client.ts",
      { COGNITO_USER_POOL_ID: cognitoPool.userPoolId }
    );
    const updateLambda = this.createLambda(
      "update-user",
      "users/update-user-client.ts",
      { COGNITO_USER_POOL_ID: cognitoPool.userPoolId }
    );

    [createLambda, getLambda, deleteLambda, updateLambda].forEach(
      (lambda, index) =>
        lambda.role?.attachInlinePolicy(
          new Policy(this, `lambda-policy-${index}`, {
            statements: [
              new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                  // Create cognito client
                  "cognito-idp:DescribeUserPoolClient",
                  "cognito-idp:CreateUserPoolClient",
                  "cognito-idp:UpdateUserPoolClient",
                  "cognito-idp:DeleteUserPoolClient",
                ],
                resources: [cognitoPool.userPoolArn],
              }),
            ],
          })
        )
    );
  }

  /**
   *
   * @param functionName
   * @param entry
   * @param environment
   * @returns
   */
  createLambda(
    functionName: string,
    entry: string,
    environment: { [key: string]: string } = {}
  ): NodejsFunction {
    return new NodejsFunction(this, `${functionName}-lambda`, {
      functionName: `aws-reproduce-invalid-grant-${functionName}`,
      entry: path.join(__dirname, `../lambdas/${entry}`),
      environment,
      runtime: Runtime.NODEJS_16_X,
      handler: "handler",
      logRetention: RetentionDays.ONE_WEEK,
      tracing: Tracing.ACTIVE,
      bundling: { sourceMap: true },
    });
  }
}
