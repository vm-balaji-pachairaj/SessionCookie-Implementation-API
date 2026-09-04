import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../PrismaService/prisma.service';
import { CasbinService } from '../casbin/casbin.service';

type UserPayload = {
  employee_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  role?: string | null;
  department?: string | null;
};

const FIELD_TO_PAYLOAD = {
  employeeId: 'employee_id',
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  phone: 'phone',
  address: 'address',
  role: 'role',
  department: 'department',
} as const;

@Injectable()
export class UserManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casbinService: CasbinService,
  ) {}
  // GET all users / search
async getUsers(
  search?: string,
  includeInactive = false,
  roleName = '',
) {
  const users =
    await this.prisma.userManagementPoc.findMany({
      where: {
        // Normal user listing should only show active users.
        // Activate page sends includeInactive=true.
        ...(includeInactive
          ? {}
          : {
              isActive: true,
            }),

        ...(search
          ? {
              OR: [
                {
                  employeeId: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  firstName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  lastName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },

      orderBy: {
        id: "asc",
      },
    });

  return {
    message: "Users fetched successfully",
    data: await Promise.all(users.map((user) => this.filterUser(user, roleName, 'userList'))),
  };
}

  // GET one user
  async getUser(id: number, roleName = '') {
    const user = await this.prisma.userManagementPoc.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'User fetched successfully',
      data: await this.filterUser(user, roleName, 'userForm'),
    };
  }

  // CREATE user
  async createUser(body: unknown, roleName = '') {
    const payload = this.asPayload(body);
    await this.assertEditableFields(payload, roleName);
    const user = await this.prisma.userManagementPoc.create({
      data: {
        employeeId: payload.employee_id ?? '',
        firstName: payload.first_name ?? '',
        lastName: payload.last_name ?? '',
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        role: payload.role,
        department: payload.department,
      },
    });

    return {
      message: 'User created successfully',
      data: user,
    };
  }

  // UPDATE user
  async updateUser(id: number, body: unknown, roleName = '') {
    const existingUser =
      await this.prisma.userManagementPoc.findUnique({
        where: { id },
      });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const payload = this.asPayload(body);
    await this.assertEditableFields(payload, roleName);

    const updateData: Record<string, string | null | Date> = {
      updatedAt: new Date(),
    };

    // Only update fields that are provided
    if (payload.employee_id !== undefined) updateData.employeeId = payload.employee_id;
    if (payload.first_name !== undefined) updateData.firstName = payload.first_name;
    if (payload.last_name !== undefined) updateData.lastName = payload.last_name;
    if (payload.email !== undefined) updateData.email = payload.email;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.address !== undefined) updateData.address = payload.address;
    if (payload.role !== undefined) updateData.role = payload.role;
    if (payload.department !== undefined) updateData.department = payload.department;

    const updatedUser =
      await this.prisma.userManagementPoc.update({
        where: { id },
        data: updateData,
      });

    return {
      message: 'User updated successfully',
      data: updatedUser,
    };
  }

  // DEACTIVATE user
  async deactivateUser(id: number, _roleName = '') {
    const existingUser =
      await this.prisma.userManagementPoc.findUnique({
        where: { id },
      });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (!existingUser.isActive) {
      return {
        message: 'User is already deactivated',
        data: existingUser,
      };
    }

    const deactivatedUser =
      await this.prisma.userManagementPoc.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

    return {
      message: 'User deactivated successfully',
      data: deactivatedUser,
    };
  }


  // ACTIVATE user
  async activateUser(id: number, _roleName = '') {
    const existingUser =
      await this.prisma.userManagementPoc.findUnique({
        where: { id },
      });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (existingUser.isActive) {
      return {
        message: 'User is already active',
        data: existingUser,
      };
    }

    const activatedUser =
      await this.prisma.userManagementPoc.update({
        where: { id },
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
      });

    return {
      message: 'User activated successfully',
      data: activatedUser,
    };
  }

  private asPayload(body: unknown): UserPayload {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ForbiddenException('A user payload object is required');
    }
    return body as UserPayload;
  }

  private async assertEditableFields(payload: UserPayload, roleName: string): Promise<void> {
    for (const [field, key] of Object.entries(FIELD_TO_PAYLOAD)) {
      if (payload[key] === undefined) continue;
      const section = ['employeeId', 'firstName', 'lastName'].includes(field)
        ? 'basicDetails'
        : ['email', 'phone', 'address'].includes(field)
          ? 'contactDetails'
          : 'roleAccess';
      const allowed = await this.casbinService.enforceField(
        roleName, 'hcp', 'userManagement', 'userForm', section, field, 'edit',
      );
      if (!allowed) {
        throw new ForbiddenException(`You do not have edit access to the ${field} field`);
      }
    }
  }

  private async filterUser<T extends Record<string, unknown>>(
    user: T,
    roleName: string,
    module: 'userList' | 'userForm',
  ): Promise<Partial<T>> {
    const result: Partial<T> = {
      id: user.id,
      isActive: user.isActive,
    } as unknown as Partial<T>;
    for (const field of Object.keys(FIELD_TO_PAYLOAD)) {
      const section = module === 'userList'
        ? 'columns'
        : ['employeeId', 'firstName', 'lastName'].includes(field)
          ? 'basicDetails'
          : ['email', 'phone', 'address'].includes(field)
            ? 'contactDetails'
            : 'roleAccess';
      const canView = await this.casbinService.enforceField(
        roleName, 'hcp', 'userManagement', module, section, field, 'view',
      );
      const canEdit = await this.casbinService.enforceField(
        roleName, 'hcp', 'userManagement', module, section, field, 'edit',
      );
      if (canView || canEdit) result[field as keyof T] = user[field as keyof T];
    }
    return result;
  }
  
}
