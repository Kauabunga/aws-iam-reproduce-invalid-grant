import * as path from "path";

import { App, Stack, Duration, RemovalPolicy } from "aws-cdk-lib";
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
  SecurityPolicy,
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

export class CdkResourcesStack extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id);

    const cognitoPool = this.setupCognitoPool();

    this.setupApiGateway(cognitoPool);

    this.setupUserClientLambda(cognitoPool);
  }

  /**
   * Create the cognito pool
   */
  setupCognitoPool() {
    const cognitoPool = new UserPool(this, "cognito-account-external", {
      userPoolName: "account-external-pool",
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
      cognitoDomain: { domainPrefix: "reproduce-invalid-grant" },
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
        logGroupName: `/awsbug/apigateway/rest-api-reproduce-invalid-grant`,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    // rest api
    const restApi = new RestApi(this, `api-gateway-reproduce-iam-error`, {
      restApiName: `AWS Reproduce iam error`,
      description: `API Gateway - AWS Reproduce iam error`,
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
          authorizerName: "SsoAuthoriser",
        }
      ),
    });
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

    [createLambda, getLambda, deleteLambda, updateLambda].forEach((lambda) =>
      lambda.role?.attachInlinePolicy(
        new Policy(this, `lambda-policy-${lambda.functionName}`, {
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
      functionName: `aws-reproduce-iam-invalid-grant-${functionName}`,
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
