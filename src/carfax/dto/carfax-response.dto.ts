export class CarFAXResponseDto {
  success: boolean;
  data?: {
    vin: string;
    make: string;
    model: string;
    year: number;
    mileage?: number;
    accidents: number;
    owners: number;
    serviceRecords: number;
    titleStatus: string;
    lastServiceDate?: string;
    reportId: string;
    reportData?: any;
  };
  error?: string;
  message?: string;
}
