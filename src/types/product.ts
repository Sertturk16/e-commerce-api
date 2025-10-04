import { z } from 'zod';
import { CATEGORIES } from '../constants/categories';

export const productVariantSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const createProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters'),
  description: z.string().optional(),
  price: z.number().positive('Price must be greater than 0'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Invalid category' }) }),
  images: z.array(z.string()).optional(),
  variants: z.array(productVariantSchema).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters').optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be greater than 0').optional(),
  stock: z.number().int().min(0, 'Stock cannot be negative').optional(),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Invalid category' }) }).optional(),
  images: z.array(z.string()).optional(),
  variants: z.array(productVariantSchema).optional(),
});

export const updateStockSchema = z.object({
  stock: z.number().int().min(0, 'Stock cannot be negative'),
});

export type ProductVariant = z.infer<typeof productVariantSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
