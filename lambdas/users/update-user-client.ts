import { UpdateUserPoolClientResponse } from "aws-sdk/clients/cognitoidentityserviceprovider";
import { updateUserPoolClientOAuthScopes, handlerWrapper } from "../lib";

export const handler = handlerWrapper(
  async (event): Promise<UpdateUserPoolClientResponse> => {
    const clientId = event?.clientId;
    const scopes = event?.scopes || ["platform/openid", "accounts/read"];

    const client = await updateUserPoolClientOAuthScopes(clientId, scopes);

    console.log("Updated client:", client);

    return client;
  }
);
