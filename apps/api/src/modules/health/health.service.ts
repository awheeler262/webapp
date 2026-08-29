import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { HealthRequestDto, HealthResponseDto } from '@my-app/validation';
import { HeartExample } from './heart-example';

@Injectable()
export class HealthService {
  // TODO: Add later -- private readonly logger = new Logger(HealthService.name);

  constructor(private config: ConfigService) {}

  async process(dto: HealthRequestDto): Promise<HealthResponseDto> {
    return {
      service: dto.service,
      timestamp: dto.timestamp,
      count: dto.count,
      hash: dto.hash,
      status: 'submitted',
    };
  }

  async getHeartExample(): Promise<string> {
    const heart = new HeartExample();
    return heart.create();
  }

}
