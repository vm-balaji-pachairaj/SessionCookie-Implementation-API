import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { UserManagementService } from './users.service';
import { CheckPolicy } from '../casbin/casbin.decorator';
import type { TokenPayload } from '../app.service';

@Controller('api/user-management')
export class UserManagementController {
  constructor(
    private readonly userManagementService: UserManagementService,
  ) {}

  // Search / list
  @Get('users')
  @CheckPolicy({ menu: 'user_management', section: 'users', access: 'read' })
  async getUsers(
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
    @Req() request?: Request & { user?: TokenPayload },
  ) {
    return this.userManagementService.getUsers(
      search,
      includeInactive === 'true',
      this.getRole(request),
    );
  }

  // Get single user
  @Get('users/:id')
  @CheckPolicy({ menu: 'user_management', section: 'users', access: 'read' })
  async getUser(
    @Param('id') id: string,
    @Req() request?: Request & { user?: TokenPayload },
  ) {
    return this.userManagementService.getUser(Number(id), this.getRole(request));
  }

  // Create
  @Post('users')
  @CheckPolicy({ menu: 'user_management', section: 'users', field: 'user_actions', access: 'edit' })
  async createUser(
    @Body() body: unknown,
    @Req() request?: Request & { user?: TokenPayload },
  ) {
    return this.userManagementService.createUser(body, this.getRole(request));
  }

  // Update
  @Put('users/:id')
  @CheckPolicy({ menu: 'user_management', section: 'users', field: 'user_actions', access: 'edit' })
  async updateUser(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request?: Request & { user?: TokenPayload },
  ) {
    return this.userManagementService.updateUser(
      Number(id),
      body,
      this.getRole(request),
    );
  }

  // Deactivate
  @Patch('users/:id/deactivate')
  @CheckPolicy({ menu: 'user_management', section: 'users', field: 'user_actions', access: 'edit' })
  async deactivateUser(
    @Param('id') id: string,
    @Req() request?: Request & { user?: TokenPayload },
  ) {
    return this.userManagementService.deactivateUser(Number(id), this.getRole(request));
  }

  // Activate
  @Patch('users/:id/activate')
  @CheckPolicy({ menu: 'user_management', section: 'users', field: 'user_actions', access: 'edit' })
  async activateUser(
    @Param('id') id: string,
    @Req() request?: Request & { user?: TokenPayload },
  ) {
    return this.userManagementService.activateUser(
      Number(id),
      this.getRole(request),
    );
  }

  private getRole(request?: Request & { user?: TokenPayload }): string {
    return request?.user?.userDetails?.role_name ?? '';
  }
}
