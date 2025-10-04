// No input validation needed - productId comes from URL params
// User ID comes from authenticated user context

export interface FavoriteProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  images: string | null;
  stock: number;
  seller_id: string;
  favorited_at: Date;
}
