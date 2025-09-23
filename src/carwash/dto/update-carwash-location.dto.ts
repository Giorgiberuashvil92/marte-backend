import { PartialType } from '@nestjs/mapped-types';
import { CreateCarwashLocationDto } from './create-carwash-location.dto';
import { IsNumber } from 'class-validator';

export class UpdateCarwashLocationDto extends PartialType(
  CreateCarwashLocationDto,
) {
  @IsNumber()
  updatedAt: number;
}
