import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class CreateDismantlerDto {
  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  yearFrom: number;

  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  yearTo: number;

  @IsArray()
  @IsOptional()
  photos?: string[];

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+995|995)?[0-9]{9,13}$/, {
    message: 'ტელეფონის ნომერი უნდა იყოს ქართული ფორმატით (+995XXXXXXXXX)',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsString()
  @IsNotEmpty()
  ownerId: string;
}
