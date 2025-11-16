import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CarFAXRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(17, 17, { message: 'VIN ნომერი უნდა შედგებოდეს 17 სიმბოლოსგან' })
  vin: string;
}
