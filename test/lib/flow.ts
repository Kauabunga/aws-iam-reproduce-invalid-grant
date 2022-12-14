import { backOff } from "exponential-backoff";
import parseISO from "date-fns/parseISO";
import isValid from "date-fns/isValid";
import formatDistanceStrict from "date-fns/formatDistanceStrict";

import { executeLambda, getExecuteLambdaResponse } from "./lambda";
import { authenticate } from "./oauth";
import { call } from "./api";

const LAMBDA_NAME_CREATE_CLIENT = "aws-reproduce-invalid-grant-create-user";
const LAMBDA_NAME_GET_CLIENT = "aws-reproduce-invalid-grant-get-user";
const LAMBDA_NAME_DELETE_CLIENT = "aws-reproduce-invalid-grant-delete-user";
const LAMBDA_NAME_UPDATE_CLIENT = "aws-reproduce-invalid-grant-update-user";

export async function createClient() {
  const response = await executeLambda(LAMBDA_NAME_CREATE_CLIENT);
  const { UserPoolClient } = getExecuteLambdaResponse(response);
  return UserPoolClient;
}

export async function getClient(clientId: string) {
  const response = await executeLambda(LAMBDA_NAME_GET_CLIENT, {
    clientId,
  });
  return getExecuteLambdaResponse(response);
}

export async function deleteClient(clientId: string) {
  // Clean up client
  await executeLambda(LAMBDA_NAME_DELETE_CLIENT, { clientId });
}

export async function updateClient(clientId: string, scopes: string[]) {
  const response = await executeLambda(LAMBDA_NAME_UPDATE_CLIENT, {
    clientId,
    scopes,
  });
  const { UserPoolClient } = getExecuteLambdaResponse(response);
  return UserPoolClient;
}

export async function retryValidateClient(
  ClientId: string,
  ClientSecret: string
) {
  return validateClient(ClientId, ClientSecret).catch((err) => {
    console.error("Client failed first attempt", { ClientId, ClientSecret });

    return backOff(() => validateClient(ClientId, ClientSecret), {
      jitter: "full",
      maxDelay: 10000,
      numOfAttempts: 100,
    }).then(async () => {
      const debug = await getDebugData(ClientId);

      console.error("Client resolved", {
        ClientId,
        ClientSecret,
        debug,
      });
    });
  });
}

export async function validateClient(ClientId: string, ClientSecret: string) {
  // Authenticate against example api
  const tokenResponse = await authenticate(ClientId, ClientSecret);
  if (!tokenResponse.ok) {
    // Bug reproduced here
    // 400 {"error":"invalid_grant"}

    return handleInvalidResponse(
      "Invalid token response",
      ClientId,
      tokenResponse
    );
  }

  const { access_token } = await tokenResponse.json();

  // Call API
  const apiResponse = await call(access_token);
  if (!apiResponse.ok) {
    return handleInvalidResponse(
      `Invalid api response: access_token=${access_token}`,
      ClientId,
      tokenResponse
    );
  }
}

export async function handleInvalidResponse(
  message: string,
  clientId: string,
  tokenResponse: Response
) {
  const [text, debug] = await Promise.all([
    tokenResponse.text().catch((err) => err),
    getDebugData(clientId),
  ]);

  console.error("Invalid client error:", {
    clientId,
    message,
    text,
    debug,
  });

  throw new Error(`Invalid Client Error ${clientId} (${tokenResponse.status})`);
}

export async function getDebugData(clientId: string) {
  const client = await getClient(clientId).catch((err) => err);
  const UserPoolClient = client?.UserPoolClient;
  const clientLastModifiedDate = parseISO(UserPoolClient?.LastModifiedDate);
  const now = new Date();
  const distanceSinceLastModifiedDate = isValid(clientLastModifiedDate)
    ? formatDistanceStrict(now, clientLastModifiedDate)
    : "Invalid Client LastModifiedDate";

  return {
    distanceSinceLastModifiedDate,
    now: now.toISOString(),
    UserPoolClient,
  };
}
