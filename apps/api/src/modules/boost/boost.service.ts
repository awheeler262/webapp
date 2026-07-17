import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  LambdaClient,
  InvokeCommand,
  InvokeCommandOutput,
} from '@aws-sdk/client-lambda';
import { ConfigService } from '../../config/config.service';
import { BoostRequestDto, BoostResponseDto } from '@my-app/validation';
import { LAMBDA_CLIENT } from './boost.constants';

export interface BoostProxyRequest {
  method: string;
  path: string;
  queryString: string;
  headers: Record<string, string>;
  sourceIp: string;
}

@Injectable()
export class BoostService {
  constructor(
    private config: ConfigService,
    @Inject(LAMBDA_CLIENT) private lambda: LambdaClient,
  ) {}

  async query(
    dto: BoostRequestDto,
    proxyRequest: BoostProxyRequest,
  ): Promise<BoostResponseDto> {
    const { method, path, queryString, headers, sourceIp } = proxyRequest;

    // Building synthetic API Gateway proxy event for direct invoke
    const payload = {
      version: '2.0',
      routeKey: `${method} ${path}`,
      rawPath: path,
      rawQueryString: queryString,
      headers: { 'content-type': 'application/json', ...headers },
      requestContext: {
        http: { method, path, protocol: 'HTTP/1.1', sourceIp },
      },
      body: JSON.stringify(dto),
      isBase64Encoded: false,
    };

    const command = new InvokeCommand({
      FunctionName: this.config.getBoostFunctionName(),
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    let response: InvokeCommandOutput;
    try {
      response = await this.lambda.send(command);
    } catch (err) {
      throw new ServiceUnavailableException('Boost function invoke failed', {
        cause: err,
      });
    }

    // Invoke can succeed at the transport level while the downstream function
    // threw internally -- distinct from the SDK-level failure above, so it
    // gets its own message even though there's no precedent yet for a more
    // specific exception type than ServiceUnavailableException.
    if (response.FunctionError) {
      throw new ServiceUnavailableException(
        `Boost function returned an error: ${response.FunctionError}`,
        {
          cause: new Error(
            response.Payload
              ? Buffer.from(response.Payload).toString('utf-8')
              : response.FunctionError,
          ),
        },
      );
    }

    const result = this.parseResponse(response.Payload);
    if (!result) {
      throw new ServiceUnavailableException(
        'Boost function returned an invalid response',
      );
    }
    return result;
  }

  // Lightweight duck-typed validation, consistent with isConnectivityError()'s
  // style elsewhere in this codebase -- avoids a class-validator/class-transformer
  // runtime-validation pass for a single-field response shape.
  private parseResponse(
    payload: Uint8Array | undefined,
  ): BoostResponseDto | null {
    if (!payload) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(payload).toString('utf-8'));
    } catch {
      return null;
    }
    if (typeof (parsed as { message?: unknown })?.message !== 'string')
      return null;
    return parsed as BoostResponseDto;
  }

  async status() {
    return { message: 'ok' };
  }
}
