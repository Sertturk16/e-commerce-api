import { prisma } from '../config/database';
import { CreateProductInput, UpdateProductInput, UpdateStockInput } from '../types/product';
import { cacheService, CacheKeys } from '../utils/cache';

export class ProductService {
  async createProduct(sellerId: string, data: CreateProductInput) {
    // Verify seller exists
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { id: true, role: true }
    });

    if (!seller) {
      throw new Error('Seller not found');
    }

    if (seller.role !== 'SELLER') {
      throw new Error('User is not a seller');
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        category: data.category,
        seller_id: sellerId,
        images: data.images ? JSON.stringify(data.images) : null,
        variants: data.variants ? JSON.stringify(data.variants) : null,
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Invalidate product list caches
    cacheService.deletePattern(CacheKeys.allProductLists());
    cacheService.deletePattern(CacheKeys.productsByCategory(data.category));
    cacheService.deletePattern(CacheKeys.productsBySeller(sellerId));

    return this.formatProduct(product);
  }

  async updateProduct(productId: string, sellerId: string, data: UpdateProductInput) {
    // Verify product exists and belongs to seller
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      throw new Error('Product not found');
    }

    if (existingProduct.seller_id !== sellerId) {
      throw new Error('Unauthorized');
    }


    // Update product
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.price && { price: data.price }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.category && { category: data.category }),
        ...(data.images && { images: JSON.stringify(data.images) }),
        ...(data.variants && { variants: JSON.stringify(data.variants) }),
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Invalidate caches
    cacheService.delete(CacheKeys.product(productId)); // Specific product
    cacheService.deletePattern(CacheKeys.allProductLists()); // All product lists
    cacheService.deletePattern(CacheKeys.productsByCategory(existingProduct.category)); // Old category
    if (data.category && data.category !== existingProduct.category) {
      cacheService.deletePattern(CacheKeys.productsByCategory(data.category)); // New category if changed
    }
    cacheService.deletePattern(CacheKeys.productsBySeller(sellerId));

    return this.formatProduct(product);
  }

  async getSellerProducts(sellerId: string) {
    const products = await prisma.product.findMany({
      where: { seller_id: sellerId },
      orderBy: {
        created_at: 'desc',
      },
    });

    return products.map((p) => this.formatProduct(p));
  }

  async updateStock(productId: string, sellerId: string, data: UpdateStockInput) {
    // Verify product exists and belongs to seller
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      throw new Error('Product not found');
    }

    if (existingProduct.seller_id !== sellerId) {
      throw new Error('Unauthorized');
    }

    // Update stock
    const product = await prisma.product.update({
      where: { id: productId },
      data: { stock: data.stock },
    });

    // Invalidate caches (stock affects availability)
    cacheService.delete(CacheKeys.product(productId));
    cacheService.deletePattern(CacheKeys.allProductLists());
    cacheService.deletePattern(CacheKeys.productsByCategory(existingProduct.category));
    cacheService.deletePattern(CacheKeys.productsBySeller(sellerId));

    return this.formatProduct(product);
  }

  async getPublicProducts(filters: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    sellerId?: string;
  }) {
    const where: any = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    if (filters.sellerId) {
      where.seller_id = filters.sellerId;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Calculate available stock for each product (considering active reservations)
    const productsWithAvailability = await Promise.all(
      products.map(async (product) => {
        const now = new Date();
        const reservedStock = await prisma.cartItem.aggregate({
          where: {
            product_id: product.id,
            OR: [
              { reservation_expires_at: { gt: now } },
              { reservation_expires_at: null }, // Authenticated user carts
            ],
          },
          _sum: { quantity: true },
        });

        const totalReserved = reservedStock._sum.quantity || 0;
        const availableStock = Math.max(0, product.stock - totalReserved);

        return {
          ...this.formatProduct(product),
          available_stock: availableStock,
        };
      })
    );

    return productsWithAvailability;
  }

  async getProductById(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    // Calculate available stock (considering active reservations)
    const now = new Date();
    const reservedStock = await prisma.cartItem.aggregate({
      where: {
        product_id: productId,
        OR: [
          { reservation_expires_at: { gt: now } },
          { reservation_expires_at: null }, // Authenticated user carts
        ],
      },
      _sum: { quantity: true },
    });

    const totalReserved = reservedStock._sum.quantity || 0;
    const availableStock = Math.max(0, product.stock - totalReserved);

    return {
      ...this.formatProduct(product),
      available_stock: availableStock,
    };
  }

  private formatProduct(product: any) {
    return {
      ...product,
      images: product.images ? JSON.parse(product.images) : [],
      variants: product.variants ? JSON.parse(product.variants) : [],
    };
  }
}

export const productService = new ProductService();
