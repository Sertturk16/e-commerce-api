import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create customers
  console.log('Creating customers...');
  const customers = [];
  for (let i = 0; i < 10; i++) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Test123!@#', salt);

    const customer = await prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
        salt,
        hash,
        role: 'CUSTOMER',
        phone: faker.phone.number(),
      },
    });
    customers.push(customer);
  }
  console.log(`✅ Created ${customers.length} customers`);

  // Create sellers
  console.log('Creating sellers...');
  const sellers = [];
  for (let i = 0; i < 5; i++) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Test123!@#', salt);

    const seller = await prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        name: faker.company.name(),
        salt,
        hash,
        role: 'SELLER',
        phone: faker.phone.number(),
      },
    });
    sellers.push(seller);
  }
  console.log(`✅ Created ${sellers.length} sellers`);

  // Create addresses for customers
  console.log('Creating addresses...');
  let addressCount = 0;
  for (const customer of customers) {
    const numAddresses = faker.number.int({ min: 1, max: 3 });
    for (let i = 0; i < numAddresses; i++) {
      await prisma.address.create({
        data: {
          user_id: customer.id,
          title: i === 0 ? 'Home' : i === 1 ? 'Work' : 'Other',
          full_name: customer.name,
          phone: customer.phone || faker.phone.number(),
          country: 'Turkey',
          city: faker.location.city(),
          district: faker.location.county(),
          postal_code: faker.location.zipCode(),
          address_line: faker.location.streetAddress(),
          is_default: i === 0,
        },
      });
      addressCount++;
    }
  }
  console.log(`✅ Created ${addressCount} addresses`);

  // Create products
  console.log('Creating products...');
  const categories = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Toys'];
  const products = [];
  for (const seller of sellers) {
    const numProducts = faker.number.int({ min: 5, max: 15 });
    for (let i = 0; i < numProducts; i++) {
      const product = await prisma.product.create({
        data: {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          price: parseFloat(faker.commerce.price({ min: 10, max: 1000 })),
          stock: faker.number.int({ min: 0, max: 100 }),
          category: faker.helpers.arrayElement(categories),
          seller_id: seller.id,
          images: JSON.stringify([
            faker.image.url(),
            faker.image.url(),
          ]),
          variants: JSON.stringify([
            { color: faker.color.human(), size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL']) },
          ]),
        },
      });
      products.push(product);
    }
  }
  console.log(`✅ Created ${products.length} products`);

  // Create favorites
  console.log('Creating favorites...');
  let favoriteCount = 0;
  for (const customer of customers) {
    const numFavorites = faker.number.int({ min: 0, max: 10 });
    const favoriteProducts = faker.helpers.arrayElements(products, numFavorites);
    for (const product of favoriteProducts) {
      await prisma.favorite.create({
        data: {
          user_id: customer.id,
          product_id: product.id,
        },
      });
      favoriteCount++;
    }
  }
  console.log(`✅ Created ${favoriteCount} favorites`);

  // Create carts with items
  console.log('Creating carts...');
  let cartCount = 0;
  let cartItemCount = 0;
  for (const customer of customers.slice(0, 5)) {
    const cart = await prisma.cart.create({
      data: {
        user_id: customer.id,
      },
    });
    cartCount++;

    // Add 1-5 items to cart
    const numItems = faker.number.int({ min: 1, max: 5 });
    const cartProducts = faker.helpers.arrayElements(
      products.filter(p => p.stock > 0),
      numItems
    );

    for (const product of cartProducts) {
      const quantity = faker.number.int({ min: 1, max: Math.min(3, product.stock) });
      await prisma.cartItem.create({
        data: {
          cart_id: cart.id,
          product_id: product.id,
          quantity,
          reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        },
      });
      cartItemCount++;
    }
  }
  console.log(`✅ Created ${cartCount} carts with ${cartItemCount} items`);

  // Create anonymous carts
  console.log('Creating anonymous carts...');
  let anonCartCount = 0;
  for (let i = 0; i < 3; i++) {
    const cart = await prisma.cart.create({
      data: {
        session_id: faker.string.uuid(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });
    anonCartCount++;

    const numItems = faker.number.int({ min: 1, max: 3 });
    const cartProducts = faker.helpers.arrayElements(
      products.filter(p => p.stock > 0),
      numItems
    );

    for (const product of cartProducts) {
      const quantity = faker.number.int({ min: 1, max: Math.min(2, product.stock) });
      await prisma.cartItem.create({
        data: {
          cart_id: cart.id,
          product_id: product.id,
          quantity,
          reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
    }
  }
  console.log(`✅ Created ${anonCartCount} anonymous carts`);

  // Create orders
  console.log('Creating orders...');
  let orderCount = 0;
  let orderItemCount = 0;
  const statuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const paymentStatuses = ['PENDING', 'PAID', 'FAILED'];

  for (const customer of customers.slice(0, 7)) {
    const numOrders = faker.number.int({ min: 1, max: 5 });

    for (let i = 0; i < numOrders; i++) {
      // Get customer's default address
      const address = await prisma.address.findFirst({
        where: { user_id: customer.id, is_default: true },
      });

      if (!address) continue;

      // Select random products from different sellers
      const orderProducts = faker.helpers.arrayElements(products, faker.number.int({ min: 1, max: 4 }));

      // Group by seller
      const sellerGroups = new Map<string, typeof orderProducts>();
      for (const product of orderProducts) {
        if (!sellerGroups.has(product.seller_id)) {
          sellerGroups.set(product.seller_id, []);
        }
        sellerGroups.get(product.seller_id)!.push(product);
      }

      // Create parent order
      const totalAmount = orderProducts.reduce((sum, p) => sum + p.price * faker.number.int({ min: 1, max: 3 }), 0);
      const parentOrder = await prisma.order.create({
        data: {
          user_id: customer.id,
          address_id: address.id,
          total_amount: totalAmount,
          status: faker.helpers.arrayElement(statuses),
          payment_status: faker.helpers.arrayElement(paymentStatuses),
          shipping_address: address.address_line,
          is_parent: true,
        },
      });
      orderCount++;

      // Create sub-orders for each seller
      for (const [sellerId, sellerProducts] of sellerGroups.entries()) {
        const subOrderTotal = sellerProducts.reduce((sum, p) => sum + p.price * faker.number.int({ min: 1, max: 3 }), 0);

        const subOrder = await prisma.order.create({
          data: {
            user_id: customer.id,
            address_id: address.id,
            parent_order_id: parentOrder.id,
            seller_id: sellerId,
            total_amount: subOrderTotal,
            status: parentOrder.status,
            payment_status: parentOrder.payment_status,
            shipping_address: address.address_line,
            is_parent: false,
          },
        });
        orderCount++;

        // Create order items
        for (const product of sellerProducts) {
          const quantity = faker.number.int({ min: 1, max: 3 });
          await prisma.orderItem.create({
            data: {
              order_id: subOrder.id,
              product_id: product.id,
              seller_id: sellerId,
              quantity,
              price: product.price,
              status: subOrder.status,
            },
          });
          orderItemCount++;
        }
      }
    }
  }
  console.log(`✅ Created ${orderCount} orders with ${orderItemCount} items`);

  console.log('🎉 Database seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Users: ${customers.length + sellers.length} (${customers.length} customers, ${sellers.length} sellers)`);
  console.log(`   - Addresses: ${addressCount}`);
  console.log(`   - Products: ${products.length}`);
  console.log(`   - Favorites: ${favoriteCount}`);
  console.log(`   - Carts: ${cartCount + anonCartCount} (${cartCount} user carts, ${anonCartCount} anonymous)`);
  console.log(`   - Orders: ${orderCount} with ${orderItemCount} items`);
  console.log('\n🔑 Test credentials: email from output above, password: Test123!@#');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
