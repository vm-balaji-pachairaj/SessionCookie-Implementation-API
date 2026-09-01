import { Module } from '@nestjs/common';
import { PrismaModule } from '../PrismaService/prismaservice.module';
import { CasbinModule } from '../casbin/casbin.module';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  imports: [PrismaModule, CasbinModule],
  controllers: [RbacController],
  providers: [RbacService],
})
export class RbacModule {}
