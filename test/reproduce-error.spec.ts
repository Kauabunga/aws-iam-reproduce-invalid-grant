import { mapLimit } from "async";
import {
  createClient,
  deleteClient,
  retryValidateClient,
  updateClient,
  validateClient,
} from "./lib";

/**
 * Main logic to reproduce the error
 */
async function reproduceError(index: number) {
  // console.log(`Reproducing error #${index} ${ClientId}`);
  const { ClientId, ClientSecret } = await createClient();

  // Validate client can authenticate
  await validateClient(ClientId, ClientSecret);

  // Update client
  await updateClient(ClientId, [
    "platform/openid",
    "accounts/read",
    "accounts/write",
  ]);

  // Validate client can authenticate
  await retryValidateClient(ClientId, ClientSecret);

  await deleteClient(ClientId);
}

describe("Test create client", () => {
  test("Test creating lots of clients", async () => {
    const ITERATIONS = 1000;
    const COLLECTION = [...new Array(ITERATIONS)].map((_, i) => i);
    const CONCURRENCY = 2;

    await mapLimit(COLLECTION, CONCURRENCY, reproduceError);
  });
});
