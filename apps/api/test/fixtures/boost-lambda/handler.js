// Stand-in for the real Boost Lambda, which runs Mangum -- Mangum always
// wraps its response in an API Gateway proxy-style { statusCode, body }
// envelope, even on a direct lambda:InvokeFunction call with no API Gateway
// in between to unwrap it, so this mirrors that shape rather than returning
// the inner { status } payload directly.
exports.handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: `boost-test-lambda received: ${body.prompt ?? ''}`,
    }),
    headers: { 'content-type': 'application/json' },
    isBase64Encoded: false,
  };
};
