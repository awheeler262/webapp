import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
