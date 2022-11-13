import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { handlerWrapper } from "../lib";

export const handler = handlerWrapper(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return {
      statusCode: 200,
      body: JSON.stringify({ hello: "world" }),
      isBase64Encoded: false,
    };
  }
);
