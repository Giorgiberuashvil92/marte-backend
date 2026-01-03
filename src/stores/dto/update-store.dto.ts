import {
  IsString,
  IsOptional,
  IsArray,
  IsEmail,
  IsUrl,
  IsNumber,
  Matches,
  IsIn,
} from 'class-validator';

export class UpdateStoreDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn([
    'მაღაზიები',
    'ნაწილები',
    'დაშლილები',
    'ზეთები',
    'ხელოსნები',
    'ავტოსერვისები',
    'ევაკუატორი',
    'ავტონაწილები', // backward compatibility
    'სამართ-დასახურებელი', // backward compatibility
    'რემონტი', // backward compatibility
    'სხვა', // backward compatibility
  ])
  @IsOptional()
  type?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\+995|995)?[0-9]{9,13}$/, {
    message: 'ტელეფონის ნომერი უნდა იყოს ქართული ფორმატით (+995XXXXXXXXX)',
  })
  phone?: string;

  @IsString()
  @IsOptional()
  name?: string;

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

  // შიდა/ინტერნალური სურათი ( напр. admin panel cover )
  @IsOptional()
  @IsUrl()
  internalImage?: string;
}
