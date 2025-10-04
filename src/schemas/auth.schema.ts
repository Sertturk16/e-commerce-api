export const registerSchema = {
  description: 'Register a new user',
  tags: ['Auth'],
  body: {
    type: 'object',
    required: ['email', 'password', 'name', 'address_title', 'address_country', 'address_city', 'address_postal_code', 'address_line'],
    properties: {
      email: { type: 'string', format: 'email', description: 'User email address' },
      password: { type: 'string', minLength: 6, description: 'User password (min 6 characters)' },
      name: { type: 'string', description: 'User full name' },
      phone: { type: 'string', minLength: 10, description: 'Phone number (min 10 digits)' },
      role: { type: 'string', enum: ['CUSTOMER', 'SELLER'], default: 'CUSTOMER', description: 'User role' },
      address_title: { type: 'string', description: 'Address title (e.g., Home, Office)' },
      address_country: { type: 'string', description: 'Country' },
      address_city: { type: 'string', description: 'City' },
      address_postal_code: { type: 'string', description: 'Postal code' },
      address_line: { type: 'string', description: 'Street address' }
    }
  },
  response: {
    201: {
      description: 'User successfully registered',
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' }
          }
        }
      }
    },
    400: {
      description: 'Bad request',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export const loginSchema = {
  description: 'Login with email and password',
  tags: ['Auth'],
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', description: 'User email' },
      password: { type: 'string', description: 'User password' }
    }
  },
  response: {
    200: {
      description: 'Login successful',
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' }
          }
        }
      }
    },
    400: {
      description: 'Invalid credentials',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export const logoutSchema = {
  description: 'Logout and blacklist current token',
  tags: ['Auth'],
  headers: {
    type: 'object',
    required: ['authorization'],
    properties: {
      authorization: { type: 'string', description: 'Bearer token' }
    }
  },
  response: {
    200: {
      description: 'Logout successful',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export const updateProfileSchema = {
  description: 'Update user profile',
  tags: ['Auth'],
  headers: {
    type: 'object',
    required: ['authorization'],
    properties: {
      authorization: { type: 'string', description: 'Bearer token' }
    }
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'User full name' },
      phone: { type: 'string', minLength: 10, description: 'Phone number' }
    }
  },
  response: {
    200: {
      description: 'Profile updated successfully',
      type: 'object',
      properties: {
        message: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            name: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string' }
          }
        }
      }
    }
  }
};
