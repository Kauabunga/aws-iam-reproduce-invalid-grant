import fetch from "cross-fetch";
import jwt from "jsonwebtoken";

import { getTokenEndpoint } from "./constants";

export async function authenticate(clientId: string, clientSecret: string) {
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  const url = await getTokenEndpoint();

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: String(params),
  });
}

export function parseToken(token: string) {
  try {
    return jwt.decode(token);
  } catch {
    return token;
  }
}
