import Lambda from "aws-sdk/clients/lambda";

const lambda = new Lambda({
  apiVersion: "2015-03-31",
  region: "ap-southeast-2",
});

export async function executeLambda(
  name: string,
  payload: object = {}
): Promise<Lambda.InvocationResponse> {
  return lambda
    .invoke({ FunctionName: name, Payload: JSON.stringify(payload) })
    .promise();
}

export function getExecuteLambdaResponse(response: Lambda.InvocationResponse) {
  return JSON.parse(response.Payload as string);
}
