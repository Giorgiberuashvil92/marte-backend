import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthMiddleware } from './middleware/auth.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GarageModule } from './garage/garage.module';
import { AuthModule } from './auth/auth.module';
import { CarwashModule } from './carwash/carwash.module';
import { RequestsModule } from './requests/requests.module';
import { OffersModule } from './offers/offers.module';
import { CommunityModule } from './community/community.module';
import { StoresModule } from './stores/stores.module';
import { DetailingModule } from './detailing/detailing.module';
import { InteriorModule } from './interior/interior.module';
import { MessagesModule } from './messages/messages.module';
import { DismantlersModule } from './dismantlers/dismantlers.module';
import { PartsModule } from './parts/parts.module';
import { CategoriesModule } from './categories/categories.module';
import { AIModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FinancingModule } from './financing/financing.module';
import { MechanicsModule } from './mechanics/mechanics.module';
import { ServicesModule } from './services/services.module';
import { MarteModule } from './marte/marte.module';
import { CarFAXModule } from './carfax/carfax.module';
import { BOGModule } from './bog/bog.module';
import { StoriesModule } from './stories/stories.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { UsersModule } from './users/users.module';
import { CarRentalModule } from './car-rental/car-rental.module';
import { FuelPricesModule } from './fuel-prices/fuel-prices.module';
import { RecurringPaymentsModule } from './recurring-payments/recurring-payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SmsModule } from './sms/sms.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ExclusiveOfferModule } from './exclusive-offer/exclusive-offer.module';
import { EngagementModule } from './engagement/engagement.module';
import { SpecialOffersModule } from './special-offers/special-offers.module';
import { CarBrandsModule } from './car-brands/car-brands.module';
import { ReferralsModule } from './referrals/referrals.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RadarsModule } from './radars/radars.module';
import { EcommerceProductsModule } from './ecommerce-products/ecommerce-products.module';
import { FinesModule } from './fines/fines.module';
import { NewsFeedModule } from './news-feed/news-feed.module';
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
import { Dismantler, DismantlerSchema } from './schemas/dismantler.schema';
import { Part, PartSchema } from './schemas/part.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { Service, ServiceSchema } from './schemas/service.schema';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { Mechanic, MechanicSchema } from './schemas/mechanic.schema';
import { MarteOrder, MarteOrderSchema } from './schemas/marte-order.schema';
import {
  MarteAssistant,
  MarteAssistantSchema,
} from './schemas/marte-assistant.schema';
import {
  CarFAXReport,
  CarFAXReportSchema,
} from './schemas/carfax-report.schema';
import {
  Subscription,
  SubscriptionSchema,
} from './schemas/subscription.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  LoginHistory,
  LoginHistorySchema,
} from './schemas/login-history.schema';
import { CarBrand, CarBrandSchema } from './schemas/car-brand.schema';
import { Radar, RadarSchema } from './schemas/radar.schema';
import {
  EcommerceProduct,
  EcommerceProductSchema,
} from './schemas/ecommerce-product.schema';
import {
  FinesVehicle,
  FinesVehicleSchema,
} from './schemas/fines-vehicle.schema';

/** Railway/.env: ზედმეტი ბრჭყალები ან ბოლოს `;` → Invalid scheme; ვხსნით. */
function trimMongoEnv(s: string | undefined): string {
  let v = (s ?? '')
    .trim()
    .replace(/;+\s*$/g, '')
    .trim();
  while (
    (v.startsWith("'") && v.endsWith("'")) ||
    (v.startsWith('"') && v.endsWith('"'))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/**
 * Atlas შაბლონი: mongodb+srv://<db_username>:<db_password>@host/?appName=…
 * `<db_username>` / `<db_password>` არის placeholder — კოდში/`.env`-ში ჩაწერე რეალური მნიშვნელობები, ზღვარი ბრჭყალები არა.
 * ან სრული `MONGODB_URI`, ან `MONGODB_USERNAME` + `MONGODB_PASSWORD` (mongosh-ის `--username` მსგავსად).
 */
function mongooseMongoConfig(): { uri: string } {
  const full = trimMongoEnv(process.env.MONGODB_URI);
  if (full.startsWith('mongodb://') || full.startsWith('mongodb+srv://')) {
    return { uri: full };
  }

  const user = trimMongoEnv(
    process.env.MONGODB_USERNAME ??
      process.env.MONGO_USERNAME ??
      process.env.DB_USERNAME,
  );
  const pass = trimMongoEnv(
    process.env.MONGODB_PASSWORD ??
      process.env.MONGO_PASSWORD ??
      process.env.DB_PASSWORD,
  );
  const host =
    trimMongoEnv(process.env.MONGODB_HOST) || 'carappx.lh8hx2q.mongodb.net';
  const dbName = trimMongoEnv(process.env.MONGODB_DATABASE) || 'carapp-v2';
  const appName = trimMongoEnv(process.env.MONGODB_APP_NAME) || 'CarappX';

  if (!user || !pass) {
    throw new Error(
      'MongoDB: დააყენე .env-ში MONGODB_URI (სრული connection string, უსკრიპტო user:pass) ან MONGODB_USERNAME + MONGODB_PASSWORD.',
    );
  }

  const qs = new URLSearchParams({
    appName,
    retryWrites: 'true',
    w: 'majority',
    authSource: 'admin',
  });
  /** Atlas: user/pass URI-ში + authSource=admin — ცალკე mongoose user/pass ხშირად იძლევა bad auth-ს */
  const uri = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${encodeURIComponent(dbName)}?${qs.toString()}`;
  return { uri };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Explicitly specify .env file path
      load: [databaseConfig],
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      useFactory: () => mongooseMongoConfig(),
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
      { name: Dismantler.name, schema: DismantlerSchema },
      { name: Part.name, schema: PartSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Mechanic.name, schema: MechanicSchema },
      { name: MarteOrder.name, schema: MarteOrderSchema },
      { name: MarteAssistant.name, schema: MarteAssistantSchema },
      { name: CarFAXReport.name, schema: CarFAXReportSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: CarBrand.name, schema: CarBrandSchema },
      { name: Radar.name, schema: RadarSchema },
      { name: EcommerceProduct.name, schema: EcommerceProductSchema },
      { name: FinesVehicle.name, schema: FinesVehicleSchema },
    ]),
    GarageModule,
    AuthModule,
    CarwashModule,
    RequestsModule,
    OffersModule,
    CommunityModule,
    StoresModule,
    DetailingModule,
    InteriorModule,
    MessagesModule,
    DismantlersModule,
    PartsModule,
    CategoriesModule,
    AIModule,
    NotificationsModule,
    FinancingModule,
    MechanicsModule,
    ServicesModule,
    MarteModule,
    CarFAXModule,
    BOGModule,
    LoyaltyModule,
    StoriesModule,
    UsersModule,
    CarRentalModule,
    FuelPricesModule,
    RecurringPaymentsModule,
    SubscriptionsModule,
    SmsModule,
    FeedbackModule,
    ExclusiveOfferModule,
    EngagementModule,
    SpecialOffersModule,
    CarBrandsModule,
    ReferralsModule,
    AnalyticsModule,
    RadarsModule,
    EcommerceProductsModule,
    FinesModule,
    NewsFeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('marte/*');
  }
}
