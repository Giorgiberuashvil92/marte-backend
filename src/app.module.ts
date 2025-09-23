import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GarageModule } from './garage/garage.module';
import { AuthModule } from './auth/auth.module';
import { CarwashModule } from './carwash/carwash.module';
import { RequestsModule } from './requests/requests.module';
import { OffersModule } from './offers/offers.module';
import { CommunityModule } from './community/community.module';
import { StoresModule } from './stores/stores.module';
import { MessagesModule } from './messages/messages.module';
import databaseConfig from './config/database.config';

// Schemas
import { User, UserSchema } from './schemas/user.schema';
import { Car, CarSchema } from './schemas/car.schema';
import { Reminder, ReminderSchema } from './schemas/reminder.schema';
import { FuelEntry, FuelEntrySchema } from './schemas/fuel-entry.schema';
import {
  CarwashLocation,
  CarwashLocationSchema,
} from './schemas/carwash-location.schema';
import {
  CarwashBooking,
  CarwashBookingSchema,
} from './schemas/carwash-booking.schema';
import { Store, StoreSchema } from './schemas/store.schema';
import { Request, RequestSchema } from './schemas/request.schema';
import { Offer, OfferSchema } from './schemas/offer.schema';
import {
  CommunityPost,
  CommunityPostSchema,
} from './schemas/community-post.schema';
import { Comment, CommentSchema } from './schemas/comment.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri:
          process.env.MONGODB_URI ||
          'mongodb+srv://gberuashvili92:aegzol2o3jC31sj3@cluster0.hqqyz.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=Cluster0',
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Car.name, schema: CarSchema },
      { name: Reminder.name, schema: ReminderSchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
      { name: CarwashLocation.name, schema: CarwashLocationSchema },
      { name: CarwashBooking.name, schema: CarwashBookingSchema },
      { name: Store.name, schema: StoreSchema },
      { name: Request.name, schema: RequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: CommunityPost.name, schema: CommunityPostSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    GarageModule,
    AuthModule,
    CarwashModule,
    RequestsModule,
    OffersModule,
    CommunityModule,
    StoresModule,
    MessagesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
