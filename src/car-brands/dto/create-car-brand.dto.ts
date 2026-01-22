export class CreateCarBrandDto {
  name: string;
  country?: string;
  logo?: string;
  models?: string[];
  isActive?: boolean;
  order?: number;
}
