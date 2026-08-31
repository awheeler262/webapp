import { Controller, Post, Body, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthRequestDto } from '@my-app/validation';

@Controller('health')
export class HealthController {
  constructor(private service: HealthService) {}

  @Post()
  // TODO: Add @UseGuards(JwtAuthGuard) when this endpoint adds functionality
  process(@Body() dto: HealthRequestDto) {
    return this.service.process(dto);
  }

  @Get('heart/example')
  getExampleHeart() {
    return {
      content: this.service.getHeartExample(),
    };
  }
}
