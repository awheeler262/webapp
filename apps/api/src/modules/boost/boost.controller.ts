import { Controller, Post, Body, Req, UseGuards, Get } from '@nestjs/common';
import type { Request } from 'express';
import { BoostService, BoostProxyRequest } from './boost.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoostRequestDto } from '@my-app/validation';

function flattenHeaders(headers: Request['headers']): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    // Express's types claim header values are always string | string[], but
    // @codegenie/serverless-express's API Gateway v2 adapter sets
    // content-length via Buffer.byteLength() -- a raw number, uncoerced --
    // when reconstructing the request in the Lambda-hosted production path.
    // That number would otherwise round-trip through JSON.stringify() into
    // the downstream boost Lambda's invoke payload as a JSON number, which
    // Python parses as an int, and Mangum's ASGI adapter crashes calling
    // .encode() on it while building the scope's headers.
    result[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return result;
}

function extractProxyRequest(req: Request): BoostProxyRequest {
  const queryIndex = req.originalUrl.indexOf('?');
  return {
    method: req.method,
    path:
      queryIndex === -1
        ? req.originalUrl
        : req.originalUrl.slice(0, queryIndex),
    queryString: queryIndex === -1 ? '' : req.originalUrl.slice(queryIndex + 1),
    headers: flattenHeaders(req.headers),
    sourceIp: req.ip ?? req.socket.remoteAddress ?? '0.0.0.0',
  };
}

@Controller('boost')
export class BoostController {

  base = '/api/v1/';

  constructor(private service: BoostService) {}

  @Post('query')
  @UseGuards(JwtAuthGuard)
  async query(@Body() dto: BoostRequestDto, @Req() req: Request) {
    const proxyRequest = extractProxyRequest(req);
    proxyRequest.method = 'POST';
    proxyRequest.path = this.base + 'query/';
    return await this.service.invoke(dto, proxyRequest);
  }

  @Get('status')
  async status(@Req() req: Request) {
    const proxyRequest = extractProxyRequest(req);
    proxyRequest.method = 'GET';
    proxyRequest.path = this.base + 'health/';
    return await this.service.invoke(null, proxyRequest);
  }
}
