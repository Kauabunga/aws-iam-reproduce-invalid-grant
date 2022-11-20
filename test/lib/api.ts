import fetch from "cross-fetch";

import { getApiEndpoint } from "./constants";

export async function call(access_token: string) {
  const url = await getApiEndpoint();

  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
}
