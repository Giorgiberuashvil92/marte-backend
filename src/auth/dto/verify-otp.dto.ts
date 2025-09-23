import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  otpId: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}
