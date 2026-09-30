import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ExternalPart,
  ExternalPartDocument,
} from '../schemas/external-part.schema';

export interface MyPartsSearchRequest {
  make?: string;
  makeId?: number;
  modelId?: number;
  partName?: string;
  page?: number;
  limit?: number;
}

export interface MyPartsPhoto {
  large: string;
  thumbnail: string;
}

export interface MyPartsProduct {
  id: string;
  productId: number;
  title: string;
  description: string;
  price: string;
  currencyId: number;
  conditionTypeId: number;
  categoryId: number;
  locationId: number;
  shopName: string;
  sellerName: string;
  modelCompatibility: Array<{
    makeId: number;
    modelId: number;
    yearFrom?: number;
    yearTo?: number;
  }>;
  image?: string;
  thumbnail?: string;
  photos: MyPartsPhoto[];
  sourceUrl: string;
}

interface MyPartsApiPhoto {
  large?: string;
  thumbs?: string;
}

interface MyPartsApiProduct {
  product_id: number;
  title?: string;
  descr?: string;
  price?: string;
  currency_id?: number;
  cond_type_id?: number;
  cat_id?: number;
  loc_id?: number;
  shop?: { title?: string | null };
  product_user?: string;
  photos?: MyPartsApiPhoto[];
  product_models?: Array<{
    man_id: number;
    model_id: number;
    year_from?: number;
    year_to?: number;
  }>;
}

interface MyPartsApiResponse {
  statusCode: number;
  statusMessage?: string;
  data?: {
    products?: MyPartsApiProduct[];
    totalCount?: number;
    pagination?: {
      currentPage?: number;
      totalPages?: number;
      limit?: number;
    };
  };
}

@Injectable()
export class MyPartsService {
  private readonly apiUrl = 'https://api.myparts.ge/api/ka/products/get';
  private readonly appUrl = 'https://myparts.ge/ka/pr';
  private readonly knownMakeIds: Record<string, number> = {
    bmw: 3,
    ბმვ: 3,
    mercedes: 25,
    'mercedes-benz': 25,
    მერსედესი: 25,
    მერსედეს: 25,
  };

  constructor(
    @InjectModel(ExternalPart.name)
    private readonly externalPartModel: Model<ExternalPartDocument>,
  ) {}

  async searchParts(request: MyPartsSearchRequest) {
    const makeId = this.resolveMakeId(request.make, request.makeId);
    const page = this.clampNumber(request.page, 1, 1, 50);
    const limit = this.clampNumber(request.limit, 5, 1, 100);

    if (!makeId && !request.partName?.trim()) {
      throw new BadRequestException({
        success: false,
        message: 'make/makeId ან partName აუცილებელია',
      });
    }

    const cached = await this.searchCachedParts({ makeId, request, page, limit });
    if (cached.products.length > 0) {
      return cached;
    }

    const payload: Record<string, string | number> = {
      pr_type_id: 1,
      page,
      limit,
    };

    if (makeId) payload.man_id = makeId;
    if (request.modelId) payload.model_id = request.modelId;
    if (request.partName?.trim()) payload.keyword = request.partName.trim();

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: 'https://myparts.ge',
        Referer: 'https://myparts.ge/ka/search/',
        'User-Agent': 'MartePartsCompatibility/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new BadRequestException({
        success: false,
        message: `MyParts request failed: ${response.status}`,
      });
    }

    const json = (await response.json()) as MyPartsApiResponse;
    if (json.statusCode !== 1) {
      throw new BadRequestException({
        success: false,
        message: json.statusMessage || 'MyParts მონაცემი ვერ წამოვიდა',
      });
    }

    const products = (json.data?.products || []).map((product) =>
      this.normalizeProduct(product),
    );

    return {
      source: 'myparts.ge',
      cached: false,
      request: payload,
      totalFound: json.data?.totalCount || products.length,
      pagination: json.data?.pagination || {
        currentPage: page,
        totalPages: 1,
        limit,
      },
      products,
    };
  }

  private async searchCachedParts({
    makeId,
    request,
    page,
    limit,
  }: {
    makeId?: number;
    request: MyPartsSearchRequest;
    page: number;
    limit: number;
  }) {
    const query: Record<string, unknown> = { source: 'myparts.ge' };
    if (makeId) query.makeId = makeId;
    if (request.modelId) query.modelIds = request.modelId;
    if (request.partName?.trim()) {
      query.title = { $regex: request.partName.trim(), $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const [products, totalFound] = await Promise.all([
      this.externalPartModel
        .find(query)
        .sort({ lastFetchedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.externalPartModel.countDocuments(query),
    ]);

    return {
      source: 'myparts.ge',
      cached: true,
      request: {
        pr_type_id: 1,
        ...(makeId ? { man_id: makeId } : {}),
        ...(request.modelId ? { model_id: request.modelId } : {}),
        ...(request.partName?.trim() ? { keyword: request.partName.trim() } : {}),
        page,
        limit,
      },
      totalFound,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalFound / limit)),
        limit,
      },
      products: products.map((product) => ({
        id: String(product.sourceProductId),
        productId: Number(product.sourceProductId),
        title: product.title,
        description: product.description,
        price: product.price,
        currencyId: product.currencyId,
        conditionTypeId: product.conditionTypeId,
        categoryId: product.categoryId,
        locationId: product.locationId,
        shopName: product.shopName,
        sellerName: product.sellerName,
        modelCompatibility: product.modelCompatibility || [],
        image: product.image,
        thumbnail: product.thumbnail,
        photos: product.photos || [],
        sourceUrl: product.sourceUrl,
      })),
    };
  }

  private normalizeProduct(product: MyPartsApiProduct): MyPartsProduct {
    const photos = (product.photos || [])
      .filter((photo) => photo.large || photo.thumbs)
      .map((photo) => ({
        large: photo.large || photo.thumbs || '',
        thumbnail: photo.thumbs || photo.large || '',
      }));
    const firstPhoto = photos[0];

    return {
      id: String(product.product_id),
      productId: product.product_id,
      title: product.title || 'უსახელო ნაწილი',
      description: product.descr || '',
      price: product.price || '0.00',
      currencyId: product.currency_id || 3,
      conditionTypeId: product.cond_type_id || 0,
      categoryId: product.cat_id || 0,
      locationId: product.loc_id || 0,
      shopName: product.shop?.title || '',
      sellerName: product.product_user || '',
      modelCompatibility: (product.product_models || []).map((model) => ({
        makeId: model.man_id,
        modelId: model.model_id,
        yearFrom: model.year_from,
        yearTo: model.year_to,
      })),
      image: firstPhoto?.large,
      thumbnail: firstPhoto?.thumbnail,
      photos,
      sourceUrl: `${this.appUrl}/${product.product_id}`,
    };
  }

  private resolveMakeId(make?: string, makeId?: number): number | undefined {
    if (makeId) return makeId;
    if (!make) return undefined;
    return this.knownMakeIds[make.trim().toLowerCase()];
  }

  private clampNumber(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    if (!value || Number.isNaN(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  }
}
