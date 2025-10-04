import { FastifyInstance } from 'fastify';
import * as addressController from '../controllers/address.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  createAddressSchema,
  getAddressesSchema,
  getAddressByIdSchema,
  updateAddressSchema,
  setDefaultAddressSchema,
  deleteAddressSchema
} from '../schemas/address.schema';

export async function addressRoutes(app: FastifyInstance) {
  // Get all user addresses
  app.get('/addresses', {
    schema: getAddressesSchema,
    preHandler: authenticate
  },
    addressController.getUserAddresses
  );

  // Get address by ID
  app.get('/addresses/:id', {
    schema: getAddressByIdSchema,
    preHandler: authenticate
  },
    addressController.getAddressById
  );

  // Create new address
  app.post('/addresses', {
    schema: createAddressSchema,
    preHandler: authenticate
  },
    addressController.createAddress
  );

  // Update address
  app.put('/addresses/:id', {
    schema: updateAddressSchema,
    preHandler: authenticate
  },
    addressController.updateAddress
  );

  // Set address as default
  app.put('/addresses/:id/default', {
    schema: setDefaultAddressSchema,
    preHandler: authenticate
  },
    addressController.setDefaultAddress
  );

  // Delete address
  app.delete('/addresses/:id', {
    schema: deleteAddressSchema,
    preHandler: authenticate
  },
    addressController.deleteAddress
  );
}
