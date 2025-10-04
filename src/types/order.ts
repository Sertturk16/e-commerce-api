import { z } from 'zod';

// Order status enum
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

// Payment status enum
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// Create order schema
export const createOrderSchema = z.object({
  address_id: z.string().uuid('Invalid address ID'),
  payment_method: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Cancel order schema
export const cancelOrderSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

// Update order status schema (for seller)
export const updateOrderStatusSchema = z.object({
  status: z.enum([
    OrderStatus.CONFIRMED,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ]),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// Order item response type
export interface OrderItemResponse {
  id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  seller_id: string;
  seller_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  status: string;
}

// Order response type
export interface OrderResponse {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  shipping_address: string;
  created_at: Date;
  updated_at: Date;
  items: OrderItemResponse[];
}

// Seller order response (grouped by seller)
export interface SellerOrderResponse {
  order_id: string;
  order_item_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  status: string;
  shipping_address: string;
  created_at: Date;
  updated_at: Date;
}
