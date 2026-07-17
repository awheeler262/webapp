import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BoostService, BoostProxyRequest } from './boost.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoostRequestDto } from '@my-app/validation';

function flattenHeaders(headers: Request['headers']): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result[key] = Array.isArray(value) ? value.join(', ') : value;
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
  constructor(private service: BoostService) {}

  @Post('query')
  @UseGuards(JwtAuthGuard)
  async query(@Body() dto: BoostRequestDto, @Req() req: Request) {
    return await this.service.query(dto, extractProxyRequest(req));
  }

  @Post('status')
  @UseGuards(JwtAuthGuard)
  async status(@Body() dto: BoostRequestDto) {
    return await this.service.status();
  }
}
