import { z } from 'zod';
import { IsDateString, IsEmail, IsIn, IsNumber, IsString, Matches, Min, MinLength } from 'class-validator';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

// Zod type for frontend use
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Class for NestJS use
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class BoostRequestDto {
  @IsString()
  prompt: string;
}

export class BoostResponseDto {
  @IsString()
  status: string;
}

// The set of health data categories the backend accepts. Adding a new
// category panel on the frontend (see apps/web's health.vue CATEGORIES)
// requires adding its id here too -- deliberately, since this drives what
// gets accepted for what's ultimately billing attribution, not just a free
// -text label.
export const HEALTH_SERVICES = ['heart'] as const;
export type HealthService = typeof HEALTH_SERVICES[number];

export class HealthRequestDto {
  @IsIn(HEALTH_SERVICES)
  service: HealthService;

  @IsDateString()
  timestamp: string;

  @IsNumber()
  @Min(0)
  count: number;

  // Lowercase hex SHA-256 digest -- exactly what hashFile() in
  // apps/web's useHealthUpload.ts always produces.
  @Matches(/^[a-f0-9]{64}$/)
  hash: string;
}

export class HealthResponseDto extends HealthRequestDto {
  @IsString()
  status: string;
}
