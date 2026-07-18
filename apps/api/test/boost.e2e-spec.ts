import { LambdaClient } from '@aws-sdk/client-lambda';
import { BoostService } from '../src/modules/boost/boost.service';
import { ConfigService } from '../src/config/config.service';

// sam local start-lambda's emulated Invoke API, started manually beforehand.
// Deliberately not port 3001 -- that's this repo's `pnpm dev:api` port.
const SAM_LOCAL_LAMBDA_ENDPOINT = 'http://127.0.0.1:3002';

// Must match the logical ID in test/fixtures/boost-lambda/template.yaml --
// sam local start-lambda keys invocations on logical ID, not an ARN, when
// no FunctionName property is set in the template.
const BOOST_TEST_FUNCTION_LOGICAL_ID = 'BoostTestFunction';

// Cold-starting the Docker container for the first invocation of a function
// can take several seconds -- past Jest's default 5000ms per-test timeout.
const LAMBDA_COLD_START_TIMEOUT_MS = 20_000;

describe('BoostService -> sam local start-lambda (e2e)', () => {
  let service: BoostService;

  beforeAll(() => {
    const lambda = new LambdaClient({
      endpoint: SAM_LOCAL_LAMBDA_ENDPOINT,
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });

    const config = {
      getBoostFunctionName: () => BOOST_TEST_FUNCTION_LOGICAL_ID,
    } as unknown as ConfigService;

    service = new BoostService(config, lambda);
  });

  it(
    'invokes the local Lambda over the network and parses its { message } response',
    async () => {
      const dto = { prompt: 'hello from boost e2e test' };
      const proxyRequest = {
        method: 'POST',
        path: '/boost/query',
        queryString: '',
        headers: {},
        sourceIp: '127.0.0.1',
      };

      const result = await service.invoke(dto, proxyRequest);

      expect(result).toEqual({
        message: 'boost-test-lambda received: hello from boost e2e test',
      });
    },
    LAMBDA_COLD_START_TIMEOUT_MS,
  );

  it(
    'invokes the local Lambda with a null dto, matching the status() health-check path',
    async () => {
      const proxyRequest = {
        method: 'GET',
        path: '/health',
        queryString: '',
        headers: {},
        sourceIp: '127.0.0.1',
      };

      const result = await service.invoke(null, proxyRequest);

      expect(result).toEqual({
        message: 'boost-test-lambda received: ',
      });
    },
    LAMBDA_COLD_START_TIMEOUT_MS,
  );
});
