import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../PrismaService/prisma.service';
import { CasbinService } from '../casbin/casbin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PrismaService, CasbinService],
  exports: [AdminService],
})
export class AdminModule {}
