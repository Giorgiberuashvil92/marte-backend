export class UpdateEcommerceProductDto {
  title?: string;
  description?: string;
  price?: number;
  originalPrice?: number;
  images?: string[];
  category?: string;
  brand?: string;
  sku?: string;
  stock?: number;
  inStock?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  specifications?: Record<string, any>;
  tags?: string[];
}
