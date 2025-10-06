import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEmail,
  IsUrl,
  IsNumber,
  Matches,
  IsIn,
} from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsIn(['ავტონაწილები', 'სამართ-დასახურებელი', 'რემონტი', 'სხვა'])
  type: 'ავტონაწილები' | 'სამართ-დასახურებელი' | 'რემონტი' | 'სხვა';

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  address: string;

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
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

  // Optional coordinates
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  services?: string[];

  @IsOptional()
  @IsArray()
  specializations?: string[];

  // Contact information
  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsString()
  alternativePhone?: string;

  // Social media
  @IsOptional()
  @IsUrl()
  facebook?: string;

  @IsOptional()
  @IsUrl()
  instagram?: string;

  @IsOptional()
  @IsUrl()
  youtube?: string;

  // Business info
  @IsOptional()
  @IsNumber()
  yearEstablished?: number;

  @IsOptional()
  @IsNumber()
  employeeCount?: number;

  @IsOptional()
  @IsString()
  license?: string;

  @IsString()
  @IsNotEmpty()
  ownerId: string;
}
