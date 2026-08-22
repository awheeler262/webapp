import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { HealthRequestDto, HealthResponseDto } from '@my-app/validation';

@Injectable()
export class HealthService {
  // TODO: Add later -- private readonly logger = new Logger(HealthService.name);

  constructor(private config: ConfigService) {}

  process(dto: HealthRequestDto): HealthResponseDto {
    return {
      service: dto.service,
      timestamp: dto.timestamp,
      count: dto.count,
      hash: dto.hash,
      status: 'submitted',
    };
  }
}
