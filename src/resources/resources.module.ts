import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { CasbinModule } from '../casbin/casbin.module';

@Module({
  imports: [CasbinModule],
  controllers: [ResourcesController],
})
export class ResourcesModule {}

