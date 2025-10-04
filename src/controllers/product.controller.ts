import { FastifyRequest, FastifyReply } from 'fastify';
import { productService } from '../services/product.service';
import { CATEGORIES } from '../constants/categories';

export async function getCategories(_request: FastifyRequest, reply: FastifyReply) {
  return reply.code(200).send({ categories: CATEGORIES });
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

    const products = await productService.getPublicProducts({
      category,
      minPrice: min_price ? parseFloat(min_price) : undefined,
      maxPrice: max_price ? parseFloat(max_price) : undefined,
      search,
      sellerId: seller_id,
    });

    return reply.code(200).send({ products });
  } catch (error) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function getProductById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const product = await productService.getProductById(id);

    if (!product) {
      return reply.code(404).send({ error: 'Product not found' });
    }

    return reply.code(200).send({ product });
  } catch (error) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
