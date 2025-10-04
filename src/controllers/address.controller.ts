import { FastifyRequest, FastifyReply } from 'fastify';
import * as addressService from '../services/address.service';
import { createAddressSchema, updateAddressSchema, CreateAddressInput, UpdateAddressInput } from '../types/address';

export async function getUserAddresses(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id;
    const addresses = await addressService.getUserAddresses(userId);
    return reply.code(200).send({ addresses });
  } catch (error: any) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function getAddressById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const address = await addressService.getAddressById(userId, id);
    return reply.code(200).send({ address });
  } catch (error: any) {
    if (error.message === 'Address not found') {
      return reply.code(404).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function createAddress(request: FastifyRequest, reply: FastifyReply) {
  try {
    const validation = createAddressSchema.safeParse(request.body as CreateAddressInput);
    if (!validation.success) {
      return reply.code(400).send({ error: validation.error.errors[0].message });
    }

    const userId = request.user!.id;
    const address = await addressService.createAddress(userId, validation.data);
    return reply.code(201).send({ address });
  } catch (error: any) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function updateAddress(request: FastifyRequest, reply: FastifyReply) {
  try {
    const validation = updateAddressSchema.safeParse(request.body as UpdateAddressInput);
    if (!validation.success) {
      return reply.code(400).send({ error: validation.error.errors[0].message });
    }

    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const address = await addressService.updateAddress(userId, id, validation.data);
    return reply.code(200).send({ address });
  } catch (error: any) {
    if (error.message === 'Address not found') {
      return reply.code(404).send({ error: error.message });
    }
    if (error.message.includes('Cannot update address')) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function setDefaultAddress(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const address = await addressService.setDefaultAddress(userId, id);
    return reply.code(200).send({ address });
  } catch (error: any) {
    if (error.message === 'Address not found') {
      return reply.code(404).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function deleteAddress(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const result = await addressService.deleteAddress(userId, id);
    return reply.code(200).send(result);
  } catch (error: any) {
    if (error.message === 'Address not found') {
      return reply.code(404).send({ error: error.message });
    }
    if (error.message.includes('Cannot delete address')) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
