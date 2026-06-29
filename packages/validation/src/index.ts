import { z } from 'zod';
import { IsEmail, IsString, MinLength } from 'class-validator';

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
