import { z } from 'zod';

export const addToCartSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const updateCartItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
});

export const removeFromCartSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type RemoveFromCartInput = z.infer<typeof removeFromCartSchema>;

export interface CartItemResponse {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  stock_available: number;
  reservation_expires_at: Date | null;
}

export interface CartResponse {
  id: string;
  total_items: number;
  total_price: number;
  sellers: {
    seller_id: string;
    seller_name: string;
    items: CartItemResponse[];
    subtotal: number;
  }[];
}
