import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateFuelEntryDto {
  @IsString()
  @IsNotEmpty()
  carId: string;

  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  liters: number;

  @IsNumber()
  @Min(0)
  pricePerLiter: number;

  @IsNumber()
  @Min(0)
  totalPrice: number;

  @IsNumber()
  @Min(0)
  mileage: number;
}
