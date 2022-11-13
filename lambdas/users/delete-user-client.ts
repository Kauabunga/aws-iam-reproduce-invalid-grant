import { DescribeUserPoolClientResponse } from "aws-sdk/clients/cognitoidentityserviceprovider";
import {
  deleteUserPoolClient,
  getUserPoolClient,
  handlerWrapper,
} from "../lib";

export const handler = handlerWrapper(
  async (event): Promise<DescribeUserPoolClientResponse> => {
    const clientId = event?.clientId;

    const client = await getUserPoolClient(clientId);

    console.log("Deleting client:", client);
    await deleteUserPoolClient(clientId);

    return client;
  }
);
