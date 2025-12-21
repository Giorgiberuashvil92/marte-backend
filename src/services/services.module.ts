import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { AutoServicesService } from './auto-services.service';
import {
  CarwashLocation,
  CarwashLocationSchema,
} from '../schemas/carwash-location.schema';
import { Store, StoreSchema } from '../schemas/store.schema';
import { Dismantler, DismantlerSchema } from '../schemas/dismantler.schema';
import { Part, PartSchema } from '../schemas/part.schema';
import { Category, CategorySchema } from '../schemas/category.schema';
import { Service, ServiceSchema } from '../schemas/service.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CarwashLocation.name, schema: CarwashLocationSchema },
      { name: Store.name, schema: StoreSchema },
      { name: Dismantler.name, schema: DismantlerSchema },
      { name: Part.name, schema: PartSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService, AutoServicesService],
  exports: [ServicesService, AutoServicesService],
})
export class ServicesModule {}
