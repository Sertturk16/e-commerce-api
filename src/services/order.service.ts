import { prisma } from '../config/database';
import { OrderResponse, OrderStatus, PaymentStatus, SellerOrderResponse } from '../types/order';
import { DistributedLock } from '../utils/distributed-lock';
import { cacheService, CacheKeys } from '../utils/cache';

export class OrderService {
  /**
   * Create order from user's cart
   * - Validates cart has items
   * - Validates address belongs to user
   * - Validates stock availability for all items
   * - Creates order with all items
   * - Deducts stock atomically with distributed locking
   * - Clears cart after successful order
   * - If payment fails, stock is released (handled by cancellation)
   */
  async createOrder(
    userId: string,
    addressId: string,
    paymentMethod?: string
  ): Promise<OrderResponse> {
    // Get user's cart with items
    const cart = await prisma.cart.findUnique({
      where: { user_id: userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                seller: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // Validate address belongs to user
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        user_id: userId,
      },
    });

    if (!address) {
      throw new Error('Address not found or does not belong to user');
    }

    // Format address as shipping address string
    const finalShippingAddress = `${address.full_name}, ${address.address_line}, ${address.district ? address.district + ', ' : ''}${address.city}, ${address.country} ${address.postal_code}`;

    // Validate all items have sufficient stock and are active
    const now = new Date();
    for (const item of cart.items) {
      // Refetch current product data to get latest stock
      const currentProduct = await prisma.product.findUnique({
        where: { id: item.product_id },
      });

      if (!currentProduct) {
        throw new Error(`Product ${item.product.name} is no longer available`);
      }

      // Check if reservation is still valid
      if (item.reservation_expires_at && item.reservation_expires_at < now) {
        throw new Error(`Reservation for ${item.product.name} has expired. Please refresh your cart.`);
      }

      // Calculate total reserved stock by other users (excluding this user's cart)
      const reservedByOthers = await prisma.cartItem.aggregate({
        where: {
          product_id: item.product_id,
          cart_id: { not: cart.id }, // Exclude current user's cart
          OR: [
            { reservation_expires_at: { gt: now } }, // Anonymous active reservations
            { reservation_expires_at: null },         // Authenticated reservations
          ],
        },
        _sum: { quantity: true },
      });

      const totalReservedByOthers = reservedByOthers._sum.quantity || 0;
      const availableStock = currentProduct.stock - totalReservedByOthers;

      // Validate available stock (considering other users' reservations)
      if (availableStock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.product.name}. Only ${availableStock} units available.`);
      }
    }

    // Calculate total amount using current product prices
    const totalAmount = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    // Group cart items by seller
    const itemsBySeller = cart.items.reduce((acc, item) => {
      const sellerId = item.product.seller_id;
      if (!acc[sellerId]) {
        acc[sellerId] = [];
      }
      acc[sellerId].push(item);
      return acc;
    }, {} as Record<string, typeof cart.items>);

    // Create parent order and sub-orders using transaction
    const parentOrder = await prisma.$transaction(async (tx) => {
      // Create parent order (user-facing)
      const newParentOrder = await tx.order.create({
        data: {
          user_id: userId,
          address_id: addressId,
          total_amount: totalAmount,
          status: OrderStatus.PENDING,
          payment_status: PaymentStatus.PENDING,
          payment_method: paymentMethod,
          shipping_address: finalShippingAddress,
          is_parent: true,
        },
      });

      // Create sub-orders for each seller
      for (const [sellerId, items] of Object.entries(itemsBySeller)) {
        const subOrderTotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

        // Create sub-order for this seller
        const subOrder = await tx.order.create({
          data: {
            user_id: userId,
            parent_order_id: newParentOrder.id,
            seller_id: sellerId,
            address_id: addressId,
            total_amount: subOrderTotal,
            status: OrderStatus.PENDING,
            payment_status: PaymentStatus.PENDING,
            payment_method: paymentMethod,
            shipping_address: finalShippingAddress,
            is_parent: false,
          },
        });

        // Create order items and deduct stock with distributed locking
        for (const item of items) {
          const lockKey = `product:${item.product_id}:stock`;

          await DistributedLock.withLock(
            lockKey,
            async () => {
              // Get fresh product stock
              const product = await tx.product.findUnique({
                where: { id: item.product_id },
              });

              if (!product) {
                throw new Error(`Insufficient stock for ${item.product.name}`);
              }

              if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.product.name}`);
              }

              // Deduct stock atomically using conditional update
              const updateResult = await tx.product.updateMany({
                where: { id: item.product_id, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } },
              });

              if (updateResult.count === 0) {
                throw new Error(`Insufficient stock for ${item.product.name}`);
              }

              // Invalidate product cache after stock update
              cacheService.delete(CacheKeys.product(item.product_id));
              cacheService.deletePattern(CacheKeys.allProductLists());
              if (product.category) {
                cacheService.deletePattern(`products:.*cat:${product.category}.*`);
              }

              // Create order item in sub-order
              await tx.orderItem.create({
                data: {
                  order_id: subOrder.id,
                  product_id: item.product_id,
                  seller_id: item.product.seller_id,
                  quantity: item.quantity,
                  price: item.product.price, // Use current product price
                  status: OrderStatus.PENDING,
                },
              });
            },
            10000,
            15000
          );
        }
      }

      // Clear cart after successful order
      await tx.cartItem.deleteMany({
        where: { cart_id: cart.id },
      });

      return newParentOrder;
    });

    // Fetch and return complete order with items
    return this.getOrderById(userId, parentOrder.id);
  }

  /**
   * Get order by ID
   * If parent order, fetch all sub-orders and their items
   * If sub-order, fetch just that order
   */
  async getOrderById(userId: string, orderId: string): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
        user_id: userId,
      },
      include: {
        items: {
          include: {
            product: true,
            seller: true,
          },
        },
        sub_orders: {
          include: {
            items: {
              include: {
                product: true,
                seller: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // If this is a parent order, aggregate items from all sub-orders
    if (order.is_parent && order.sub_orders.length > 0) {
      const allItems = order.sub_orders.flatMap(subOrder => subOrder.items);
      return this.formatOrderResponse({ ...order, items: allItems });
    }

    return this.formatOrderResponse(order);
  }

  /**
   * Get all orders for a user
   * Only return parent orders (user-facing orders)
   */
  async getUserOrders(userId: string): Promise<OrderResponse[]> {
    const orders = await prisma.order.findMany({
      where: {
        user_id: userId,
        is_parent: true, // Only parent orders for user listing
      },
      include: {
        sub_orders: {
          include: {
            items: {
              include: {
                product: true,
                seller: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Aggregate items from sub-orders for each parent order
    return orders.map((order) => {
      const allItems = order.sub_orders.flatMap(subOrder => subOrder.items);
      return this.formatOrderResponse({ ...order, items: allItems });
    });
  }

  /**
   * Cancel order
   * - Only PENDING orders can be cancelled
   * - Restores stock for all items
   * - Updates order status to CANCELLED
   * - If parent order, cancels all sub-orders as well
   */
  async cancelOrder(userId: string, orderId: string): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
        user_id: userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        sub_orders: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error('Order cannot be cancelled. Only pending orders can be cancelled');
    }

    // Cancel order and restore stock using transaction
    await prisma.$transaction(async (tx) => {
      // If parent order, cancel all sub-orders
      if (order.is_parent && order.sub_orders.length > 0) {
        for (const subOrder of order.sub_orders) {
          // Update sub-order status
          await tx.order.update({
            where: { id: subOrder.id },
            data: {
              status: OrderStatus.CANCELLED,
              payment_status: PaymentStatus.REFUNDED,
            },
          });

          // Update sub-order items status
          await tx.orderItem.updateMany({
            where: { order_id: subOrder.id },
            data: {
              status: OrderStatus.CANCELLED,
            },
          });

          // Restore stock for sub-order items
          for (const item of subOrder.items) {
            const lockKey = `product:${item.product_id}:stock`;

            await DistributedLock.withLock(
              lockKey,
              async () => {
                await tx.product.update({
                  where: { id: item.product_id },
                  data: {
                    stock: {
                      increment: item.quantity,
                    },
                  },
                });

                // Invalidate product cache after stock update
                cacheService.delete(CacheKeys.product(item.product_id));
                cacheService.deletePattern(CacheKeys.allProductLists());
                if (item.product.category) {
                  cacheService.deletePattern(`products:.*cat:${item.product.category}.*`);
                }
              },
              10000,
              15000
            );
          }
        }
      } else {
        // Single order (no sub-orders) - restore stock for items
        for (const item of order.items) {
          const lockKey = `product:${item.product_id}:stock`;

          await DistributedLock.withLock(
            lockKey,
            async () => {
              await tx.product.update({
                where: { id: item.product_id },
                data: {
                  stock: {
                    increment: item.quantity,
                  },
                },
              });

              // Invalidate product cache after stock update
              cacheService.delete(CacheKeys.product(item.product_id));
              cacheService.deletePattern(CacheKeys.allProductLists());
              if (item.product.category) {
                cacheService.deletePattern(`products:.*cat:${item.product.category}.*`);
              }
            },
            10000,
            15000
          );
        }

        // Update order items status (for non-parent orders)
        await tx.orderItem.updateMany({
          where: { order_id: orderId },
          data: {
            status: OrderStatus.CANCELLED,
          },
        });
      }

      // Update parent order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          payment_status: PaymentStatus.REFUNDED,
        },
      });
    });

    return this.getOrderById(userId, orderId);
  }

  /**
   * Partial cancel - cancel a specific sub-order (seller-level cancel)
   * - Only seller can cancel their own sub-order
   * - Restores stock for items in that sub-order
   * - Parent order remains active if other sub-orders are still active
   */
  async cancelSubOrder(sellerId: string, subOrderId: string): Promise<OrderResponse> {
    // Validate sub-order belongs to seller
    const subOrder = await prisma.order.findUnique({
      where: {
        id: subOrderId,
        seller_id: sellerId,
        is_parent: false, // Must be a sub-order
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        parent_order: true,
      },
    });

    if (!subOrder) {
      throw new Error('Sub-order not found or does not belong to seller');
    }

    if (subOrder.status !== OrderStatus.PENDING && subOrder.status !== OrderStatus.CONFIRMED) {
      throw new Error('Only PENDING or CONFIRMED orders can be cancelled');
    }

    // Cancel sub-order and restore stock
    await prisma.$transaction(async (tx) => {
      // Update sub-order status
      await tx.order.update({
        where: { id: subOrderId },
        data: {
          status: OrderStatus.CANCELLED,
          payment_status: PaymentStatus.REFUNDED,
        },
      });

      // Update sub-order items status
      await tx.orderItem.updateMany({
        where: { order_id: subOrderId },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      // Restore stock for each item
      for (const item of subOrder.items) {
        const lockKey = `product:${item.product_id}:stock`;

        await DistributedLock.withLock(
          lockKey,
          async () => {
            await tx.product.update({
              where: { id: item.product_id },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            });

            // Invalidate product cache after stock update
            cacheService.delete(CacheKeys.product(item.product_id));
            cacheService.deletePattern(CacheKeys.allProductLists());
            if (item.product.category) {
              cacheService.deletePattern(`products:.*cat:${item.product.category}.*`);
            }
          },
          10000,
          15000
        );
      }

      // Check if all sub-orders are cancelled -> update parent
      if (subOrder.parent_order_id) {
        const allSubOrders = await tx.order.findMany({
          where: {
            parent_order_id: subOrder.parent_order_id,
          },
        });

        const allCancelled = allSubOrders.every(
          (o) => o.id === subOrderId || o.status === OrderStatus.CANCELLED
        );

        if (allCancelled) {
          // All sub-orders cancelled -> cancel parent
          await tx.order.update({
            where: { id: subOrder.parent_order_id },
            data: {
              status: OrderStatus.CANCELLED,
              payment_status: PaymentStatus.REFUNDED,
            },
          });
        }
      }
    });

    // Return parent order (if exists) or sub-order
    if (subOrder.parent_order_id) {
      return this.getOrderById(subOrder.user_id, subOrder.parent_order_id);
    }

    return this.getOrderById(subOrder.user_id, subOrderId);
  }

  /**
   * Get seller's orders
   * Returns all sub-orders (not parent orders) where seller_id matches
   */
  async getSellerOrders(sellerId: string): Promise<SellerOrderResponse[]> {
    // Get sub-orders that belong to this seller
    const subOrders = await prisma.order.findMany({
      where: {
        seller_id: sellerId,
        is_parent: false, // Only sub-orders, not parent orders
      },
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Flatten to order item level for backward compatibility
    const orderItems: SellerOrderResponse[] = [];
    for (const order of subOrders) {
      for (const item of order.items) {
        orderItems.push({
          order_id: order.id,
          order_item_id: item.id,
          customer_id: order.user_id,
          customer_name: order.user.name,
          customer_email: order.user.email,
          product_id: item.product_id,
          product_name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
          status: item.status,
          shipping_address: order.shipping_address,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }
    }

    return orderItems;
  }

  /**
   * Update order item status (for seller)
   * - Seller can only update their own order items
   * - Can transition: PENDING -> CONFIRMED -> SHIPPED -> DELIVERED
   */
  async updateOrderItemStatus(
    sellerId: string,
    orderItemId: string,
    status: OrderStatus
  ): Promise<SellerOrderResponse> {
    // Validate order item belongs to seller
    const orderItem = await prisma.orderItem.findUnique({
      where: {
        id: orderItemId,
        seller_id: sellerId,
      },
      include: {
        order: {
          include: {
            user: true,
            parent_order: true,
          },
        },
        product: true,
      },
    });

    if (!orderItem) {
      throw new Error('Order item not found');
    }

    // Validate status transition
    const currentStatus = orderItem.status;
    const validTransitions: Record<string, string[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new Error(`Cannot transition from ${currentStatus} to ${status}`);
    }

    // Update order item status and order status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order item status
      const updatedItem = await tx.orderItem.update({
        where: { id: orderItemId },
        data: { status },
        include: {
          order: {
            include: {
              user: true,
              parent_order: true,
            },
          },
          product: true,
        },
      });

      // Fetch the sub-order to get parent_order_id
      const subOrder = await tx.order.findUnique({
        where: { id: updatedItem.order_id },
        select: { parent_order_id: true },
      });

      // Update sub-order status
      await tx.order.update({
        where: { id: updatedItem.order_id },
        data: { status },
      });

      // Update parent order status (if this is a sub-order)
      if (subOrder?.parent_order_id) {
        await tx.order.update({
          where: { id: subOrder.parent_order_id },
          data: { status },
        });
      }

      return updatedItem;
    });

    const updatedItem = result;

    // Verify the order was updated by querying it
    // This ensures the transaction is fully committed and visible to other connections
    await prisma.order.findUnique({
      where: { id: updatedItem.order_id },
      select: { status: true }
    });

    return {
      order_id: updatedItem.order_id,
      order_item_id: updatedItem.id,
      customer_id: updatedItem.order.user_id,
      customer_name: updatedItem.order.user.name,
      customer_email: updatedItem.order.user.email,
      product_id: updatedItem.product_id,
      product_name: updatedItem.product.name,
      quantity: updatedItem.quantity,
      price: updatedItem.price,
      subtotal: updatedItem.price * updatedItem.quantity,
      status: updatedItem.status,
      shipping_address: updatedItem.order.shipping_address,
      created_at: updatedItem.created_at,
      updated_at: updatedItem.updated_at,
    };
  }

  /**
   * Format order response
   */
  private formatOrderResponse(order: any): OrderResponse {
    const images = order.items[0]?.product.images;
    if (images) {
      try {
        JSON.parse(images);
      } catch {
        // Invalid JSON
      }
    }

    return {
      id: order.id,
      user_id: order.user_id,
      total_amount: order.total_amount,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      shipping_address: order.shipping_address,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.items.map((item: any) => {
        const itemImages = item.product.images;
        let itemParsedImages: string[] = [];
        if (itemImages) {
          try {
            itemParsedImages = JSON.parse(itemImages);
          } catch {
            itemParsedImages = [];
          }
        }

        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product.name,
          product_image: itemParsedImages[0],
          seller_id: item.seller_id,
          seller_name: item.seller.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
          status: item.status,
        };
      }),
    };
  }
}

export const orderService = new OrderService();
