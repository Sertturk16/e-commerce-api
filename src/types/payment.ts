import { z } from 'zod';

export const processPaymentSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  payment_method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CASH_ON_DELIVERY']),
  card_number: z.string().optional(),
  card_holder: z.string().optional(),
  cvv: z.string().length(3, 'CVV must be 3 digits').optional(),
  expiry_date: z.string().optional(), // Format: MM/YY
});

export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
