import { prisma } from '../config/database';
import { DistributedLock } from '../utils/distributed-lock';
import { AddToCartInput, CartResponse, CartItemResponse } from '../types/cart';

const RESERVATION_TTL_MINUTES = 15;
const ANONYMOUS_CART_TTL_HOURS = 24;

export class CartService {
  /**
   * Add item to cart with stock reservation and distributed locking
   */
  async addToCart(
    userId: string | null,
    sessionId: string | null,
    data: AddToCartInput
  ): Promise<CartResponse> {
    if (!userId && !sessionId) {
      throw new Error('Either userId or sessionId must be provided');
    }

    const lockKey = `product:${data.product_id}:stock`;

    return await DistributedLock.withLock(
      lockKey,
      async () => {
        // Get product with current stock
        const product = await prisma.product.findUnique({
          where: { id: data.product_id },
          include: {
            seller: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!product) {
          throw new Error('Product not available');
        }

        // Calculate availability
        // All users (authenticated and anonymous) must respect existing active reservations
        const now = new Date();
        const reservedStock = await prisma.cartItem.aggregate({
          where: {
            product_id: data.product_id,
            OR: [
              { reservation_expires_at: { gt: now } },
              { reservation_expires_at: null }, // Authenticated user reservations
            ],
          },
          _sum: { quantity: true },
        });
        const totalReserved = reservedStock._sum.quantity || 0;
        const availableStock = product.stock - totalReserved;

        if (availableStock < data.quantity) {
          throw new Error(`Insufficient stock. Available: ${availableStock}`);
        }

        // Find or create cart
        let cart = userId
          ? await prisma.cart.findFirst({ where: { user_id: userId }, include: { items: true } })
          : sessionId
          ? await prisma.cart.findFirst({
              where: {
                session_id: sessionId,
                user_id: null,
              },
              include: { items: true },
            })
          : null;

        if (!cart) {
          // Validate that we have either userId or sessionId
          if (!userId && !sessionId) {
            throw new Error('Either user authentication or session ID is required');
          }

          // Application-level uniqueness check before creating cart
          const existingCart = userId
            ? await prisma.cart.findFirst({ where: { user_id: userId } })
            : await prisma.cart.findFirst({
                where: { session_id: sessionId, user_id: null },
              });

          if (existingCart) {
            throw new Error(
              userId
                ? 'Cart already exists for this user'
                : 'Cart already exists for this session'
            );
          }

          const expiresAt = sessionId
            ? new Date(Date.now() + ANONYMOUS_CART_TTL_HOURS * 60 * 60 * 1000)
            : null;

          try {
            // Build cart data - must have either user_id or session_id
            const cartData: any = {
              user_id: userId || null,  // Explicitly set null for anonymous carts
              session_id: sessionId || null,
              expires_at: expiresAt,
            };

            cart = await prisma.cart.create({
              data: cartData,
              include: { items: true },
            });
          } catch (error: any) {
            // Handle race condition where cart was created by another request
            if (userId) {
              cart = await prisma.cart.findFirst({
                where: { user_id: userId },
                include: { items: true },
                orderBy: { created_at: 'desc' },
              });
            } else if (sessionId) {
              // For session-based carts, get the most recent one
              cart = await prisma.cart.findFirst({
                where: {
                  session_id: sessionId,
                  user_id: null,
                },
                include: { items: true },
                orderBy: { created_at: 'desc' },
              });
            }

            if (!cart) {
              throw error;
            }
          }
        }

        // Check if item already in cart
        const existingItem = await prisma.cartItem.findUnique({
          where: {
            cart_id_product_id: {
              cart_id: cart.id,
              product_id: data.product_id,
            },
          },
        });

        const reservationExpiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

        if (existingItem) {
          // Replace quantity (not add)
          const newQuantity = data.quantity;

          // Recompute availability for new quantity
          // All users must respect other users' reservations
          const reservedExcludingCurrent = await prisma.cartItem.aggregate({
            where: {
              product_id: data.product_id,
              id: { not: existingItem.id },
              OR: [
                { reservation_expires_at: { gt: new Date() } },
                { reservation_expires_at: null },
              ],
            },
            _sum: { quantity: true },
          });
          const reservedOther = reservedExcludingCurrent._sum.quantity || 0;
          const availableStock = product.stock - reservedOther;

          if (availableStock < newQuantity) {
            throw new Error(`Insufficient stock. Available: ${availableStock}`);
          }

          await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: newQuantity,
              reservation_expires_at: reservationExpiresAt,
            },
          });
        } else {
          // Create new cart item
          await prisma.cartItem.create({
            data: {
              cart_id: cart.id,
              product_id: data.product_id,
              quantity: data.quantity,
              reservation_expires_at: reservationExpiresAt,
            },
          });
        }

        // Return updated cart
        return this.getCart(userId, sessionId);
      },
      10000, // 10 second lock TTL
      15000 // 15 second acquire timeout
    );
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(
    userId: string | null,
    sessionId: string | null,
    productId: string,
    quantity: number
  ): Promise<CartResponse> {
    if (!userId && !sessionId) {
      throw new Error('Either userId or sessionId must be provided');
    }

    const lockKey = `product:${productId}:stock`;

    return await DistributedLock.withLock(
      lockKey,
      async () => {
        // Get cart
        const cart = userId
          ? await prisma.cart.findFirst({ where: { user_id: userId } })
          : await prisma.cart.findFirst({
              where: {
                session_id: sessionId!,
                user_id: null,
              },
              orderBy: { created_at: 'desc' },
            });

        if (!cart) {
          throw new Error('Cart not found');
        }

        // Get cart item
        const cartItem = await prisma.cartItem.findUnique({
          where: {
            cart_id_product_id: {
              cart_id: cart.id,
              product_id: productId,
            },
          },
          include: {
            product: true,
          },
        });

        if (!cartItem) {
          throw new Error('Product not found in cart');
        }

        if (quantity === 0) {
          // Remove item if quantity is 0
          await prisma.cartItem.delete({
            where: { id: cartItem.id },
          });
          return this.getCart(userId, sessionId);
        }

        // Check stock availability respecting all active reservations
        // All users must respect other users' reservations
        const reservedStock = await prisma.cartItem.aggregate({
          where: {
            product_id: productId,
            id: { not: cartItem.id },
            OR: [
              { reservation_expires_at: { gt: new Date() } },
              { reservation_expires_at: null },
            ],
          },
          _sum: { quantity: true },
        });
        const totalReserved = reservedStock._sum.quantity || 0;
        const availableForUpdate = cartItem.product.stock - totalReserved;

        if (availableForUpdate < quantity) {
          throw new Error(`Insufficient stock. Available: ${availableForUpdate}`);
        }

        // Update quantity
        const reservationExpiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

        await prisma.cartItem.update({
          where: { id: cartItem.id },
          data: {
            quantity,
            reservation_expires_at: reservationExpiresAt,
          },
        });

        return this.getCart(userId, sessionId);
      },
      10000,
      15000
    );
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(
    userId: string | null,
    sessionId: string | null,
    productId: string
  ): Promise<CartResponse> {
    if (!userId && !sessionId) {
      throw new Error('Either userId or sessionId must be provided');
    }

    // Get cart
    const cart = userId
      ? await prisma.cart.findFirst({ where: { user_id: userId } })
      : await prisma.cart.findFirst({
          where: {
            session_id: sessionId!,
            user_id: null,
          },
          orderBy: { created_at: 'desc' },
        });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Check if item exists in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cart_id_product_id: {
          cart_id: cart.id,
          product_id: productId,
        },
      },
    });

    if (!existingItem) {
      throw new Error('Item not found in cart');
    }

    // Delete cart item
    await prisma.cartItem.delete({
      where: {
        cart_id_product_id: {
          cart_id: cart.id,
          product_id: productId,
        },
      },
    });

    return this.getCart(userId, sessionId);
  }

  /**
   * Merge anonymous cart with user cart on login
   */
  async mergeAnonymousCart(userId: string, sessionId: string): Promise<CartResponse> {
    // Get anonymous cart (ensure we get only anonymous carts, not user carts)
    const anonymousCart = await prisma.cart.findFirst({
      where: {
        session_id: sessionId,
        user_id: null, // Only anonymous carts
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc', // Get the most recent one
      },
    });

    if (!anonymousCart || anonymousCart.items.length === 0) {
      // No anonymous cart or empty, just return user's cart
      return this.getCart(userId, null);
    }

    // Get or create user cart
    let userCart = await prisma.cart.findFirst({
      where: { user_id: userId },
      include: { items: true },
      orderBy: { created_at: 'desc' },
    });

    if (!userCart) {
      try {
        userCart = await prisma.cart.create({
          data: {
            user_id: userId,
          },
          include: { items: true },
        });
      } catch (error: any) {
        // Handle race condition where another concurrent request created the cart
        if (error.code === 'P2002') {
          userCart = await prisma.cart.findFirst({
            where: { user_id: userId },
            include: { items: true },
            orderBy: { created_at: 'desc' },
          });
          if (!userCart) {
            throw error; // Re-throw if still not found
          }
        } else {
          throw error;
        }
      }
    }

    // Merge items and delete anonymous cart in a transaction
    await prisma.$transaction(async (tx) => {
      // Merge items from anonymous cart to user cart
      for (const anonymousItem of anonymousCart.items) {
        const lockKey = `product:${anonymousItem.product_id}:stock`;

        await DistributedLock.withLock(
          lockKey,
          async () => {
            // Check if item already exists in user cart
            const existingItem = await tx.cartItem.findUnique({
              where: {
                cart_id_product_id: {
                  cart_id: userCart.id,
                  product_id: anonymousItem.product_id,
                },
              },
            });

            // Check stock availability
            const now = new Date();
            const reservedStock = await tx.cartItem.aggregate({
              where: {
                product_id: anonymousItem.product_id,
                id: existingItem ? { not: existingItem.id } : undefined,
                OR: [
                  { reservation_expires_at: { gt: now } },
                  { reservation_expires_at: null },
                ],
              },
              _sum: {
                quantity: true,
              },
            });

            const totalReserved = reservedStock._sum.quantity || 0;
            const availableStock = anonymousItem.product.stock - totalReserved;

            const reservationExpiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

            if (existingItem) {
              // Merge quantities (add anonymous quantity to existing)
              const newQuantity = existingItem.quantity + anonymousItem.quantity;

              if (availableStock >= newQuantity - existingItem.quantity) {
                await tx.cartItem.update({
                  where: { id: existingItem.id },
                  data: {
                    quantity: newQuantity,
                    reservation_expires_at: reservationExpiresAt,
                  },
                });
              }
              // If not enough stock, skip this item (or could throw error)
            } else {
              // Add new item to user cart
              if (availableStock >= anonymousItem.quantity) {
                await tx.cartItem.create({
                  data: {
                    cart_id: userCart.id,
                    product_id: anonymousItem.product_id,
                    quantity: anonymousItem.quantity,
                    reservation_expires_at: reservationExpiresAt,
                  },
                });
              }
              // If not enough stock, skip this item
            }
          },
          10000,
          15000
        );
      }

      // Delete anonymous cart after merge (use deleteMany to avoid race condition)
      await tx.cart.deleteMany({
        where: { id: anonymousCart.id },
      });
    });

    // Return merged cart
    return this.getCart(userId, null);
  }

  /**
   * Get cart with all items
   */
  async getCart(userId: string | null, sessionId: string | null): Promise<CartResponse> {
    if (!userId && !sessionId) {
      throw new Error('Either userId or sessionId must be provided');
    }

    const now = new Date();

    // Delete expired anonymous carts
    await prisma.cart.deleteMany({
      where: {
        expires_at: {
          lt: now,
        },
      },
    });

    const cart = userId
      ? await prisma.cart.findFirst({
          where: { user_id: userId },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    seller: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
        })
      : await prisma.cart.findFirst({
          where: {
            session_id: sessionId!,
            user_id: null,
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    seller: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
        });

    if (!cart) {
      return {
        id: '',
        total_items: 0,
        total_price: 0,
        sellers: [],
      };
    }

    // Remove items with zero stock
    const itemsToRemove = cart.items.filter(
      (item) => item.product.stock === 0
    );

    if (itemsToRemove.length > 0) {
      await prisma.cartItem.deleteMany({
        where: {
          id: {
            in: itemsToRemove.map((item) => item.id),
          },
        },
      });
    }

    // Remove expired reservations
    await prisma.cartItem.deleteMany({
      where: {
        cart_id: cart.id,
        reservation_expires_at: {
          lt: now,
        },
      },
    });

    // Refresh cart data
    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                seller: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!updatedCart) {
      return {
        id: cart.id,
        total_items: 0,
        total_price: 0,
        sellers: [],
      };
    }

    // Group by seller
    const sellerMap = new Map<
      string,
      { seller_id: string; seller_name: string; items: CartItemResponse[]; subtotal: number }
    >();

    let totalPrice = 0;
    let totalItems = 0;

    updatedCart.items.forEach((item) => {
      if (!sellerMap.has(item.product.seller_id)) {
        sellerMap.set(item.product.seller_id, {
          seller_id: item.product.seller_id,
          seller_name: item.product.seller.name,
          items: [],
          subtotal: 0,
        });
      }

      const seller = sellerMap.get(item.product.seller_id)!;
      const itemSubtotal = item.product.price * item.quantity;

      seller.items.push({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        stock_available: item.product.stock,
        reservation_expires_at: item.reservation_expires_at,
      });

      seller.subtotal += itemSubtotal;
      totalPrice += itemSubtotal;
      totalItems += item.quantity;
    });

    const sellers = Array.from(sellerMap.values());

    return {
      id: updatedCart.id,
      total_items: totalItems,
      total_price: totalPrice,
      sellers,
    };
  }
}

export const cartService = new CartService();
