import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { HealthRequestDto, HealthResponseDto } from '@my-app/validation';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private config: ConfigService) {}

  process(dto: HealthRequestDto): HealthResponseDto {
    this.logger.log(JSON.stringify(dto));
    return {
      service: dto.service,
      timestamp: dto.timestamp,
      count: dto.count,
      hash: dto.hash,
      status: 'submitted',
    };
  }
}
