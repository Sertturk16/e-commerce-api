import { prisma } from '../config/database';
import { CreateAddressInput, UpdateAddressInput } from '../types/address';

export async function createAddress(userId: string, data: CreateAddressInput) {
    // If this is set as default, unset other defaults and create in a transaction
    if (data.is_default) {
      return await prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: {
            user_id: userId,
            is_default: true,
          },
          data: {
            is_default: false,
          },
        });

        const address = await tx.address.create({
          data: {
            user_id: userId,
            ...data,
          },
        });

        return address;
      });
    }

    // No transaction needed if not setting as default
    const address = await prisma.address.create({
      data: {
        user_id: userId,
        ...data,
      },
    });

    return address;
}

export async function getUserAddresses(userId: string) {
    const addresses = await prisma.address.findMany({
      where: {
        user_id: userId,
      },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });

    return addresses;
}

export async function getAddressById(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        user_id: userId, // Ensure user owns the address
      },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    return address;
}

export async function updateAddress(userId: string, addressId: string, data: UpdateAddressInput) {
    // Check if address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        user_id: userId,
      },
    });

    if (!existingAddress) {
      throw new Error('Address not found');
    }

    // Check if address has active orders (not CANCELLED or DELIVERED)
    const activeOrdersWithAddress = await prisma.order.count({
      where: {
        address_id: addressId,
        status: {
          notIn: ['CANCELLED', 'DELIVERED'],
        },
      },
    });

    if (activeOrdersWithAddress > 0) {
      // Only allow updating is_default flag for addresses with active orders
      const hasRestrictedUpdates = Object.keys(data).some((key) => key !== 'is_default');

      if (hasRestrictedUpdates) {
        throw new Error(
          'Cannot update address details while it has active orders. You can only change default status.'
        );
      }
    }

    // If setting as default, unset other defaults and update in a transaction
    if (data.is_default) {
      return await prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: {
            user_id: userId,
            is_default: true,
            id: { not: addressId },
          },
          data: {
            is_default: false,
          },
        });

        const updatedAddress = await tx.address.update({
          where: {
            id: addressId,
          },
          data,
        });

        return updatedAddress;
      });
    }

    // No transaction needed if not setting as default
    const updatedAddress = await prisma.address.update({
      where: {
        id: addressId,
      },
      data,
    });

    return updatedAddress;
}

export async function setDefaultAddress(userId: string, addressId: string) {
    // Check if address belongs to user
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        user_id: userId,
      },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    // Set as default (unset other defaults in transaction)
    return await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: {
          user_id: userId,
          is_default: true,
          id: { not: addressId },
        },
        data: {
          is_default: false,
        },
      });

      const updatedAddress = await tx.address.update({
        where: {
          id: addressId,
        },
        data: {
          is_default: true,
        },
      });

      return updatedAddress;
    });
}

export async function deleteAddress(userId: string, addressId: string) {
    // Check if address belongs to user
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        user_id: userId,
      },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    // Check if address has active orders (not CANCELLED or DELIVERED)
    const activeOrdersWithAddress = await prisma.order.count({
      where: {
        address_id: addressId,
        status: {
          notIn: ['CANCELLED', 'DELIVERED'],
        },
      },
    });

    if (activeOrdersWithAddress > 0) {
      throw new Error(
        'Cannot delete address while it has active orders (PENDING, CONFIRMED, or SHIPPED)'
      );
    }

    // Check if address is used in any delivered orders
    const deliveredOrdersWithAddress = await prisma.order.count({
      where: {
        address_id: addressId,
      },
    });

    if (deliveredOrdersWithAddress > 0) {
      throw new Error('Cannot delete address that is used in order history');
    }

    await prisma.address.delete({
      where: {
        id: addressId,
      },
    });

    return { message: 'Address deleted successfully' };
}
