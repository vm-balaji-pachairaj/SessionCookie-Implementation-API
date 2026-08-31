import { Module } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { PubSubSubscriberService } from './pubsub.subscriber.service';
import { PubSubController } from './pubsub.controller';
import { PrismaModule } from '../PrismaService/prismaservice.module';

@Module({
  imports: [PrismaModule],
  providers: [PubSubService, PubSubSubscriberService],
  controllers: [PubSubController],
  exports: [PubSubService, PubSubSubscriberService],
})
export class PubSubModule {}
