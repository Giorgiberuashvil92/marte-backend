import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EcommerceProductsService } from './ecommerce-products.service';
import { EcommerceProductsController } from './ecommerce-products.controller';
import {
  EcommerceProduct,
  EcommerceProductSchema,
} from '../schemas/ecommerce-product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EcommerceProduct.name, schema: EcommerceProductSchema },
    ]),
  ],
  controllers: [EcommerceProductsController],
  providers: [EcommerceProductsService],
  exports: [EcommerceProductsService],
})
export class EcommerceProductsModule {}
