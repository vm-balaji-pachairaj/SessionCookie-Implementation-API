import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Public } from '../public.decorator';

import { UserManagementService } from './users.service';

@Public()
@Controller('api/user-management')
export class UserManagementController {
  constructor(
    private readonly userManagementService: UserManagementService,
  ) {}

  // Search / list
  @Get("users")
  async getUsers(
    @Query("search") search?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.userManagementService.getUsers(
      search,
      includeInactive === "true",
    );
  }

  // Get single user
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.userManagementService.getUser(Number(id));
  }

  // Create
  @Post('users')
  async createUser(@Body() body: any) {
    return this.userManagementService.createUser(body);
  }

  // Update
  @Put('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.userManagementService.updateUser(
      Number(id),
      body,
    );
  }

  // Deactivate
  @Patch('users/:id/deactivate')
  async deactivateUser(@Param('id') id: string) {
    return this.userManagementService.deactivateUser(Number(id));
  }
  
  // Activate
  @Patch('users/:id/activate')
  async activateUser(@Param('id') id: string) {
    return this.userManagementService.activateUser(
      Number(id),
    );
  }
}