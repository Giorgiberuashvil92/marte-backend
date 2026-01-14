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
  IsDateString,
} from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsIn([
    'მაღაზიები',
    'ნაწილები',
    'დაშლილები',
    'ზეთები',
    'ხელოსნები',
    'ავტოსერვისები',
    'ევაკუატორი',
    'დითეილინგი',
    'აქსესუარები',
    'ავტომობილის ინტერიერი',
    'ავტონაწილები', // backward compatibility
    'სამართ-დასახურებელი', // backward compatibility
    'რემონტი', // backward compatibility
    'სხვა', // backward compatibility
  ])
  type: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  // შიდა/ინტერნალური სურათი ( напр. admin panel cover )
  @IsOptional()
  @IsUrl()
  internalImage?: string;

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

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsDateString()
  lastPaymentDate?: string;

  @IsOptional()
  @IsDateString()
  nextPaymentDate?: string;

  @IsOptional()
  @IsNumber()
  totalPaid?: number;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsNumber()
  paymentAmount?: number;

  @IsOptional()
  @IsString()
  paymentPeriod?: string;
}
