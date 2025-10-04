import { z } from 'zod';
import { UserRole } from './user';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.nativeEnum(UserRole).optional().default(UserRole.CUSTOMER),
  phone: z.string().optional(),
  // Address fields (required for registration)
  address_title: z.string().min(1, 'Address title is required'),
  address_country: z.string().min(1, 'Country is required'),
  address_city: z.string().min(1, 'City is required'),
  address_district: z.string().optional(),
  address_postal_code: z.string().min(1, 'Postal code is required'),
  address_line: z.string().min(5, 'Address must be at least 5 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  phone: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}
