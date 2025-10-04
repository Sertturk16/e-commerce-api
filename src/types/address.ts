import { z } from 'zod';

export const createAddressSchema = z.object({
  title: z.string().min(1, 'Title is required').max(50),
  full_name: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().min(10, 'Phone must be at least 10 characters').max(20),
  country: z.string().min(1, 'Country is required').max(100),
  city: z.string().min(1, 'City is required').max(100),
  district: z.string().max(100).optional(),
  postal_code: z.string().min(1, 'Postal code is required').max(20),
  address_line: z.string().min(5, 'Address must be at least 5 characters').max(500),
  is_default: z.boolean().optional().default(false),
});

export const updateAddressSchema = z.object({
  title: z.string().min(1).max(50).optional(),
  full_name: z.string().min(1).max(100).optional(),
  phone: z.string().min(10).max(20).optional(),
  country: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100).optional(),
  district: z.string().max(100).optional(),
  postal_code: z.string().min(1).max(20).optional(),
  address_line: z.string().min(5).max(500).optional(),
  is_default: z.boolean().optional(),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
