import { prisma } from '../../common/database';
import { isValidEmail,NotFoundError, ConflictError, ValidationError } from '../../common/utils';

// ============================================
// User Service
// ============================================

export interface CreateUserDto {
  email: string;
  name?: string;
  walletAddress?: string;
}

export interface UpdateUserDto {
  name?: string;
  walletAddress?: string;
}

export class UserService {
  /**
   * Create a new user
   */
  async createUser(data: CreateUserDto) {
    if (!isValidEmail(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        walletAddress: data.walletAddress,
      },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundError('User', email);
    }

    return user;
  }

  /**
   * Get or create user by email
   */
  async getOrCreateUser(data: CreateUserDto) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      return existing;
    }

    return this.createUser(data);
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: UpdateUserDto) {
    await this.getUserById(userId); // Verify exists

    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Get all users
   */
  async getAllUsers(pagination?: { page: number; pageSize: number }) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pagination ? (pagination.page - 1) * pagination.pageSize : undefined,
        take: pagination?.pageSize,
      }),
      prisma.user.count(),
    ]);

    return { users, total };
  }

  /**
   * Get user with their orders
   */
  async getUserWithOrders(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          include: {
            provider: true,
            plan: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return user;
  }
}

export const userService = new UserService();
export default userService;