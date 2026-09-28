import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EuroinsService } from './euroins.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    SubscriptionsModule,
  ],
  providers: [EuroinsService],
  exports: [EuroinsService],
})
export class EuroinsModule {}
