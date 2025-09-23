import { IsString, IsNotEmpty } from 'class-validator';

export class StartAuthDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}
