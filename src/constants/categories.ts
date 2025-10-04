export const CATEGORIES = [
  'electronics',
  'clothing',
  'books',
  'home_kitchen',
  'sports_outdoors',
  'toys_games',
  'beauty_health',
  'automotive',
] as const;

export type Category = typeof CATEGORIES[number];
