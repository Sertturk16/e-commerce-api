import { FastifyRequest, FastifyReply } from 'fastify';
import { productService } from '../services/product.service';
import { CATEGORIES } from '../constants/categories';
import { cacheService, CacheKeys, CacheTTL } from '../utils/cache';

export async function getCategories(_request: FastifyRequest, reply: FastifyReply) {
  // Try to get from cache
  const cacheKey = CacheKeys.categories();
  const cached = cacheService.get<{ categories: string[] }>(cacheKey);

  if (cached) {
    return reply.code(200).send(cached);
  }

  // Cache miss - set and return
  const data = { categories: CATEGORIES };
  cacheService.set(cacheKey, data, CacheTTL.CATEGORIES);

  return reply.code(200).send(data);
}

export async function getProducts(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { category, min_price, max_price, search, seller_id } = request.query as {
      category?: string;
      min_price?: string;
      max_price?: string;
      search?: string;
      seller_id?: string;
    };

    // Try to get from cache
    const cacheKey = CacheKeys.products({
      category,
      minPrice: min_price,
      maxPrice: max_price,
      search,
      sellerId: seller_id,
    });
    const cached = cacheService.get<{ products: any[] }>(cacheKey);

    if (cached) {
      return reply.code(200).send(cached);
    }

    // Cache miss - fetch from database
    const products = await productService.getPublicProducts({
      category,
      minPrice: min_price ? parseFloat(min_price) : undefined,
      maxPrice: max_price ? parseFloat(max_price) : undefined,
      search,
      sellerId: seller_id,
    });

    // Cache the result
    const data = { products };
    cacheService.set(cacheKey, data, CacheTTL.PRODUCT_LIST);

    return reply.code(200).send(data);
  } catch (error) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function getProductById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };

    // Try to get from cache
    const cacheKey = CacheKeys.product(id);
    const cached = cacheService.get<{ product: any }>(cacheKey);

    if (cached) {
      return reply.code(200).send(cached);
    }

    // Cache miss - fetch from database
    const product = await productService.getProductById(id);

    if (!product) {
      return reply.code(404).send({ error: 'Product not found' });
    }

    // Cache the result
    const data = { product };
    cacheService.set(cacheKey, data, CacheTTL.PRODUCT_DETAIL);

    return reply.code(200).send(data);
  } catch (error) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
