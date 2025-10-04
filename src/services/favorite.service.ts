import { prisma } from '../config/database';
import { FavoriteProduct } from '../types/favorite';

export class FavoriteService {
  async addFavorite(userId: string, productId: string) {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: productId,
        },
      },
    });

    if (existing) {
      throw new Error('Product already in favorites');
    }

    // Add to favorites
    const favorite = await prisma.favorite.create({
      data: {
        user_id: userId,
        product_id: productId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            category: true,
            images: true,
            stock: true,
            seller_id: true,
          },
        },
      },
    });

    return {
      id: favorite.product.id,
      name: favorite.product.name,
      price: favorite.product.price,
      category: favorite.product.category,
      images: favorite.product.images,
      stock: favorite.product.stock,
      seller_id: favorite.product.seller_id,
      favorited_at: favorite.created_at,
    } as FavoriteProduct;
  }

  async removeFavorite(userId: string, productId: string) {
    // Check if favorite exists
    const favorite = await prisma.favorite.findUnique({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: productId,
        },
      },
    });

    if (!favorite) {
      throw new Error('Favorite not found');
    }

    // Remove from favorites
    await prisma.favorite.delete({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: productId,
        },
      },
    });

    return { message: 'Removed from favorites' };
  }

  async getUserFavorites(userId: string): Promise<FavoriteProduct[]> {
    const favorites = await prisma.favorite.findMany({
      where: {
        user_id: userId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            category: true,
            images: true,
            stock: true,
            seller_id: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return favorites.map((fav) => ({
      id: fav.product.id,
      name: fav.product.name,
      price: fav.product.price,
      category: fav.product.category,
      images: fav.product.images,
      stock: fav.product.stock,
      seller_id: fav.product.seller_id,
      favorited_at: fav.created_at,
    }));
  }
}

export const favoriteService = new FavoriteService();
