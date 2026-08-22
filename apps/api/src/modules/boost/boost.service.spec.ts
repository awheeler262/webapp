import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { InvokeCommand } from '@aws-sdk/client-lambda';
import { BoostService, BoostProxyRequest } from './boost.service';
import { ConfigService } from '../../config/config.service';
import { LAMBDA_CLIENT } from './boost.constants';

// Typed as the real command class instead of the `any` a bare jest.fn()
// would otherwise hand back -- satisfies this repo's no-unsafe-* lint rules.
type LambdaClientMock = { send: jest.Mock<Promise<unknown>, [InvokeCommand]> };

function sentCommand(lambda: LambdaClientMock): InvokeCommand {
  return lambda.send.mock.calls[0][0];
}

function sentEvent<T>(command: InvokeCommand): T {
  return JSON.parse(Buffer.from(command.input.Payload!).toString('utf-8')) as T;
}

describe('BoostService', () => {
  let service: BoostService;
  let lambda: LambdaClientMock;

  const proxyRequest: BoostProxyRequest = {
    method: 'POST',
    path: '/boost/query',
    queryString: '',
    headers: {},
    sourceIp: '127.0.0.1',
  };

  function payloadBuffer(value: unknown): Buffer {
    return Buffer.from(JSON.stringify(value));
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoostService,
        {
          provide: ConfigService,
          useValue: {
            getBoostFunctionName: jest
              .fn()
              .mockReturnValue('test-boost-function'),
          },
        },
        {
          provide: LAMBDA_CLIENT,
          useValue: { send: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(BoostService);
    lambda = module.get(LAMBDA_CLIENT);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('the invoke event it builds', () => {
    it('sends an InvokeCommand targeting the configured function with a synthetic API Gateway v2 payload', async () => {
      lambda.send.mockResolvedValue({
        Payload: payloadBuffer({ status: 'ok' }),
      });

      await service.invoke({ prompt: 'hello' }, proxyRequest);

      expect(lambda.send).toHaveBeenCalledTimes(1);
      const command = sentCommand(lambda);
      expect(command.input.FunctionName).toBe('test-boost-function');
      expect(command.input.InvocationType).toBe('RequestResponse');

      const event = sentEvent<{
        routeKey: string;
        rawPath: string;
        requestContext: { http: unknown };
        body: string;
      }>(command);
      expect(event.routeKey).toBe('POST /boost/query');
      expect(event.rawPath).toBe('/boost/query');
      expect(event.requestContext.http).toEqual({
        method: 'POST',
        path: '/boost/query',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
      });
      expect(JSON.parse(event.body)).toEqual({ prompt: 'hello' });
    });

    it('sends a null body when dto is null', async () => {
      lambda.send.mockResolvedValue({
        Payload: payloadBuffer({ status: 'ok' }),
      });

      await service.invoke(null, proxyRequest);

      const command = sentCommand(lambda);
      const event = sentEvent<{ body: string | null }>(command);
      expect(event.body).toBeNull();
    });
  });

  describe('when the SDK call itself fails', () => {
    it('throws ServiceUnavailableException', async () => {
      lambda.send.mockRejectedValue(new Error('network blip'));

      await expect(service.invoke(null, proxyRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('when the invoked function reports a FunctionError', () => {
    it('throws ServiceUnavailableException', async () => {
      lambda.send.mockResolvedValue({
        FunctionError: 'Unhandled',
        Payload: payloadBuffer({ errorMessage: 'boom' }),
      });

      await expect(service.invoke(null, proxyRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('response parsing', () => {
    it('throws ServiceUnavailableException when there is no payload', async () => {
      lambda.send.mockResolvedValue({});

      await expect(service.invoke(null, proxyRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when the payload is not JSON', async () => {
      lambda.send.mockResolvedValue({ Payload: Buffer.from('not json') });

      await expect(service.invoke(null, proxyRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('unwraps a Mangum-style { body: "<json>" } envelope and returns the parsed inner body', async () => {
      lambda.send.mockResolvedValue({
        Payload: payloadBuffer({
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ status: 'ok from lambda' }),
        }),
      });

      const result = await service.invoke(null, proxyRequest);

      expect(result).toEqual({ status: 'ok from lambda' });
    });

    it('throws ServiceUnavailableException when the wrapped body is not JSON', async () => {
      lambda.send.mockResolvedValue({
        Payload: payloadBuffer({ statusCode: 200, body: 'not json' }),
      });

      await expect(service.invoke(null, proxyRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('accepts an unwrapped response with a top-level status string', async () => {
      lambda.send.mockResolvedValue({
        Payload: payloadBuffer({ status: 'direct ok' }),
      });

      const result = await service.invoke(null, proxyRequest);

      expect(result).toEqual({ status: 'direct ok' });
    });

    it('throws ServiceUnavailableException when the response has no status field', async () => {
      lambda.send.mockResolvedValue({ Payload: payloadBuffer({ foo: 'bar' }) });

      await expect(service.invoke(null, proxyRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when status is not a string', async () => {
      lambda.send.mockResolvedValue({ Payload: payloadBuffer({ status: 42 }) });

      await expect(service.invoke(null, proxyRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
