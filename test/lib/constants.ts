import Ssm from "aws-sdk/clients/ssm";

const ssm = new Ssm({
  apiVersion: "2014-11-06",
  region: "ap-southeast-2",
});

export const TOKEN_ENDPOINT =
  "https://reproduce-invalid-grant.auth.ap-southeast-2.amazoncognito.com/oauth2/token";

export const getTokenEndpoint = makeSsmGetter(
  "/reproduce-aws-invalid-grant/cognito-token-url",
  undefined
);

export const getApiEndpoint = makeSsmGetter(
  "/reproduce-aws-invalid-grant/apigateway-url",
  undefined
);

function makeSsmGetter(param: string, fallback?: string) {
  let cache: string;
  return async () => {
    if (cache) {
      return cache;
    }

    cache = await ssm
      .getParameter({ Name: param })
      .promise()
      .then((item) => String(item.Parameter?.Value))
      .catch((err) => {
        console.error("Error getting parameter", { param, fallback, err });
        if (!fallback) {
          throw err;
        }

        return fallback;
      });

    return cache;
  };
}
