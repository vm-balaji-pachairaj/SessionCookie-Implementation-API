import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../PrismaService/prisma.service';

@Injectable()
export class UserManagementService {
  constructor(private readonly prisma: PrismaService) {}
  // GET all users / search
async getUsers(
  search?: string,
  includeInactive = false,
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
    data: users,
  };
}

  // GET one user
  async getUser(id: number) {
    const user = await this.prisma.userManagementPoc.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'User fetched successfully',
      data: user,
    };
  }

  // CREATE user
  async createUser(body: any) {
    const user = await this.prisma.userManagementPoc.create({
      data: {
        employeeId: body.employee_id,
        firstName: body.first_name,
        lastName: body.last_name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        role: body.role,
        department: body.department,
      },
    });

    return {
      message: 'User created successfully',
      data: user,
    };
  }

  // UPDATE user
  async updateUser(id: number, body: any) {
    const existingUser =
      await this.prisma.userManagementPoc.findUnique({
        where: { id },
      });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only update fields that are provided
    if (body.employee_id !== undefined) updateData.employeeId = body.employee_id;
    if (body.first_name !== undefined) updateData.firstName = body.first_name;
    if (body.last_name !== undefined) updateData.lastName = body.last_name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.department !== undefined) updateData.department = body.department;

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
  async deactivateUser(id: number) {
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
  async activateUser(id: number) {
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
  
}