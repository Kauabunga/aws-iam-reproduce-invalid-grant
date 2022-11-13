import CognitoIdentityServiceProvider from "aws-sdk/clients/cognitoidentityserviceprovider";
import { COGNITO_USER_POOL_ID } from "./constants";

const cognito = new CognitoIdentityServiceProvider({
  apiVersion: "2016-04-18",
});

const DEFAULT_USER_POOL_CLIENT = {
  AllowedOAuthFlows: ["client_credentials"],
  SupportedIdentityProviders: ["COGNITO"],
  PreventUserExistenceErrors: "ENABLED",
  AllowedOAuthFlowsUserPoolClient: true,
};

/**
 * Aux function to create a user pool client
 *
 * @param name
 * @param scopes
 * @returns
 *
 * @private
 */
export async function createUserPoolClient(name: string, scopes: string[]) {
  return cognito
    .createUserPoolClient({
      UserPoolId: COGNITO_USER_POOL_ID,
      ClientName: name,
      AllowedOAuthScopes: scopes,
      GenerateSecret: true,
      ...DEFAULT_USER_POOL_CLIENT,
    })
    .promise();
}

/**
 * Aux function to get user pool client
 *
 * @param clientId
 * @returns
 *
 * @private
 */
export async function getUserPoolClient(clientId: string) {
  return cognito
    .describeUserPoolClient({
      UserPoolId: COGNITO_USER_POOL_ID,
      ClientId: clientId,
    })
    .promise();
}

/**
 * Aux function to update the user pool client oauth scopes
 *
 * @param clientId
 * @param scopes
 * @returns
 *
 * @private
 */
export async function updateUserPoolClientOAuthScopes(
  clientId: string,
  scopes: string[]
) {
  return cognito
    .updateUserPoolClient({
      UserPoolId: COGNITO_USER_POOL_ID,
      ClientId: clientId,
      AllowedOAuthScopes: scopes,
      ...DEFAULT_USER_POOL_CLIENT,
    })
    .promise();
}

/**
 * Aux function to delete the user pool client
 *
 * @param clientId
 * @returns
 *
 * @private
 */
export async function deleteUserPoolClient(clientId: string) {
  return cognito
    .deleteUserPoolClient({
      UserPoolId: COGNITO_USER_POOL_ID,
      ClientId: clientId,
    })
    .promise();
}
