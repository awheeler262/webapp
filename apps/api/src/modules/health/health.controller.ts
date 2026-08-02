import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HealthRequestDto } from '@my-app/validation';

@Controller('health')
export class HealthController {
  constructor(private service: HealthService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  process(@Body() dto: HealthRequestDto) {
    return this.service.process(dto);
  }
}
