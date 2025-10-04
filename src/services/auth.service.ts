import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { RegisterInput, LoginInput, UpdateProfileInput } from '../types/auth';

export class AuthService {
  async register(data: RegisterInput) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(data.password, salt);

    // Create user with default address in a transaction
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        salt,
        hash,
        role: data.role || 'CUSTOMER',
        phone: data.phone,
        addresses: {
          create: {
            title: data.address_title,
            full_name: data.name,
            phone: data.phone || '',
            country: data.address_country,
            city: data.address_city,
            district: data.address_district,
            postal_code: data.address_postal_code,
            address_line: data.address_line,
            is_default: true,
          },
        },
      },
      include: {
        addresses: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  async login(data: LoginInput) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.hash);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    // Update user profile
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        phone: data.phone,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
    };
  }
}

export const authService = new AuthService();
