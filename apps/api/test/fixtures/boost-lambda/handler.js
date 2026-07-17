// Stand-in for the real Boost Lambda. Returns the raw `{ message }` shape
// that BoostService.parseResponse() expects directly -- not an API Gateway
// proxy-style { statusCode, body } wrapper -- matching the current contract.
exports.handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  return { message: `boost-test-lambda received: ${body.prompt ?? ''}` };
};
