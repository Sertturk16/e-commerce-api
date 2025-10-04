import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Starting database cleanup...');

  // Delete in correct order to respect foreign key constraints
  console.log('Deleting order items...');
  const deletedOrderItems = await prisma.orderItem.deleteMany();
  console.log(`✅ Deleted ${deletedOrderItems.count} order items`);

  console.log('Deleting orders...');
  const deletedOrders = await prisma.order.deleteMany();
  console.log(`✅ Deleted ${deletedOrders.count} orders`);

  console.log('Deleting cart items...');
  const deletedCartItems = await prisma.cartItem.deleteMany();
  console.log(`✅ Deleted ${deletedCartItems.count} cart items`);

  console.log('Deleting carts...');
  const deletedCarts = await prisma.cart.deleteMany();
  console.log(`✅ Deleted ${deletedCarts.count} carts`);

  console.log('Deleting favorites...');
  const deletedFavorites = await prisma.favorite.deleteMany();
  console.log(`✅ Deleted ${deletedFavorites.count} favorites`);

  console.log('Deleting addresses...');
  const deletedAddresses = await prisma.address.deleteMany();
  console.log(`✅ Deleted ${deletedAddresses.count} addresses`);

  console.log('Deleting products...');
  const deletedProducts = await prisma.product.deleteMany();
  console.log(`✅ Deleted ${deletedProducts.count} products`);

  console.log('Deleting users...');
  const deletedUsers = await prisma.user.deleteMany();
  console.log(`✅ Deleted ${deletedUsers.count} users`);

  console.log('🎉 Database cleanup completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error clearing database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
