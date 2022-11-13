import { CreateUserPoolClientResponse } from "aws-sdk/clients/cognitoidentityserviceprovider";
import { createUserPoolClient, handlerWrapper } from "../lib";

export const handler = handlerWrapper(
  async (event): Promise<CreateUserPoolClientResponse> => {
    const name = event?.name || "DefaultClientName";
    const scopes = event?.scopes || ["platform/openid", "accounts/read"];

    const client = await createUserPoolClient(name, scopes);

    console.log("Created client:", client);

    return client;
  }
);
