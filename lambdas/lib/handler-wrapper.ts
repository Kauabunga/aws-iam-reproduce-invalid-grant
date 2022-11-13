export function handlerWrapper(
  handlerFunction: (event: any, context?: any) => any
) {
  return async function (event: any, context: any) {
    try {
      console.log("EVENT:", JSON.stringify(event, null, 2));

      // call lambda handler
      const result = await handlerFunction(event, context);

      console.log("RESULT:", JSON.stringify(result, null, 2));

      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };
}
