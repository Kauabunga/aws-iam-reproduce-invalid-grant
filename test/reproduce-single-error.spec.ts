import { getDebugData, retryValidateClient } from "./lib";

describe("Test create client", () => {
  test("Validate a single (existing) client", async () => {
    const credentials = [
      {
        ClientId: "7c9ftontme747kglfp1g3i783n",
        ClientSecret: "XXX",
      },
    ];

    // Validate client can authenticate
    await Promise.all(
      credentials.map((credential) =>
        retryValidateClient(credential.ClientId, credential.ClientSecret).then(
          async () => {
            const debug = await getDebugData(credential.ClientId);
            console.log("Client success", debug);
          }
        )
      )
    );
  });
});
