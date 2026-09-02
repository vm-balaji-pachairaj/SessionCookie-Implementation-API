import { Module } from '@nestjs/common';
import { PrismaModule } from '../PrismaService/prismaservice.module';
import { CasbinModule } from '../casbin/casbin.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule, CasbinModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
