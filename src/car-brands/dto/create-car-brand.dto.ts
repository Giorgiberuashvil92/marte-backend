export class CreateCarBrandDto {
  name: string;
  myautoManId?: string;
  country?: string;
  logo?: string;
  models?: string[];
  isActive?: boolean;
  order?: number;
}
