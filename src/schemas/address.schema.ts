export const createAddressSchema = {
  description: 'Create a new address',
  tags: ['Addresses'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['title', 'full_name', 'phone', 'country', 'city', 'postal_code', 'address_line'],
    properties: {
      title: { type: 'string', description: 'Address title (e.g., Home, Office)' },
      full_name: { type: 'string', description: 'Recipient full name' },
      phone: { type: 'string', minLength: 10, description: 'Phone number' },
      country: { type: 'string', description: 'Country' },
      city: { type: 'string', description: 'City' },
      district: { type: 'string', description: 'District (optional)' },
      postal_code: { type: 'string', description: 'Postal code' },
      address_line: { type: 'string', description: 'Street address' },
      is_default: { type: 'boolean', description: 'Set as default address' }
    }
  },
  response: {
    201: {
      description: 'Address created',
      type: 'object',
      properties: {
        message: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            is_default: { type: 'boolean' }
          }
        }
      }
    }
  }
};

export const getAddressesSchema = {
  description: 'Get all user addresses',
  tags: ['Addresses'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'List of addresses',
      type: 'object',
      properties: {
        addresses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              full_name: { type: 'string' },
              phone: { type: 'string' },
              city: { type: 'string' },
              is_default: { type: 'boolean' }
            }
          }
        }
      }
    }
  }
};

export const getAddressByIdSchema = {
  description: 'Get address by ID',
  tags: ['Addresses'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Address ID' }
    }
  },
  response: {
    200: {
      description: 'Address details',
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            full_name: { type: 'string' },
            phone: { type: 'string' },
            country: { type: 'string' },
            city: { type: 'string' },
            postal_code: { type: 'string' },
            address_line: { type: 'string' },
            is_default: { type: 'boolean' }
          }
        }
      }
    }
  }
};

export const updateAddressSchema = {
  description: 'Update address details',
  tags: ['Addresses'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Address ID' }
    }
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      full_name: { type: 'string' },
      phone: { type: 'string', minLength: 10 },
      country: { type: 'string' },
      city: { type: 'string' },
      postal_code: { type: 'string' },
      address_line: { type: 'string' }
    }
  },
  response: {
    200: {
      description: 'Address updated',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};

export const setDefaultAddressSchema = {
  description: 'Set address as default',
  tags: ['Addresses'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Address ID' }
    }
  },
  response: {
    200: {
      description: 'Default address updated',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};

export const deleteAddressSchema = {
  description: 'Delete address',
  tags: ['Addresses'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Address ID' }
    }
  },
  response: {
    200: {
      description: 'Address deleted',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};
