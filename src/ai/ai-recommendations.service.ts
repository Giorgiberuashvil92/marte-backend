import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store, StoreDocument } from '../schemas/store.schema';
import { Dismantler, DismantlerDocument } from '../schemas/dismantler.schema';
import { Part, PartDocument } from '../schemas/part.schema';
import { Request, RequestDocument } from '../schemas/request.schema';
import { User, UserDocument } from '../schemas/user.schema';

export interface AIRecommendation {
  id: string;
  type: 'store' | 'dismantler' | 'part';
  name: string;
  description: string;
  location: string;
  phone: string;
  distance?: number;
  confidence: number; // 0-1, how well this matches the request
  matchReasons: string[]; // Why this was recommended
  price?: string;
  images?: string[];
}

export interface PartsRequest {
  vehicle: {
    make: string;
    model: string;
    year?: string;
    submodel?: string;
  };
  partName: string;
  partDetails?: string;
  location?: string;
  maxDistance?: number; // km
}

@Injectable()
export class AIRecommendationsService {
  constructor(
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    @InjectModel(Dismantler.name)
    private dismantlerModel: Model<DismantlerDocument>,
    @InjectModel(Part.name) private partModel: Model<PartDocument>,
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async recommendForPartsRequest(
    request: PartsRequest,
  ): Promise<AIRecommendation[]> {
    const { vehicle, partName, location } = request;

    console.log('🤖 AI Recommendations for:', { vehicle, partName, location });

    const recommendations: AIRecommendation[] = [];

    // 1. Search in Parts collection (direct parts)
    const parts = await this.findMatchingParts(vehicle, partName, location);
    console.log(`🔍 [AI] Found ${parts.length} matching parts`);
    recommendations.push(...parts);

    // 2. Search in Stores collection (stores that might have this part)
    const stores = await this.findMatchingStores(vehicle, partName, location);
    console.log(`🔍 [AI] Found ${stores.length} matching stores`);
    recommendations.push(...stores);

    // 3. Search in Dismantlers collection (dismantlers with matching cars)
    const dismantlers = await this.findMatchingDismantlers(
      vehicle,
      partName,
      location,
    );
    console.log(`🔍 [AI] Found ${dismantlers.length} matching dismantlers`);
    if (dismantlers.length > 0) {
      console.log(
        `🔍 [AI] Dismantler details:`,
        dismantlers.map((d) => ({
          name: d.name,
          brand: d.matchReasons.find((r) => r.includes('ბრენდი')),
          model: d.matchReasons.find((r) => r.includes('მოდელი')),
          confidence: d.confidence,
        })),
      );
    }
    recommendations.push(...dismantlers);

    // Sort by confidence score
    const sortedRecommendations = recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20); // Return top 20 recommendations

    console.log(
      `🤖 Generated ${sortedRecommendations.length} recommendations (${parts.length} parts, ${stores.length} stores, ${dismantlers.length} dismantlers)`,
    );
    return sortedRecommendations;
  }

  async getSellerStatus(params: {
    userId: string;
    phone?: string;
    make?: string;
    model?: string;
    year?: string;
    debug?: boolean;
  }): Promise<{
    showSellerPanel: boolean;
    counts: { stores: number; parts: number; dismantlers: number };
    matchingRequests: Request[];
    ownedStores: Array<{
      id: string;
      title: string;
      type: string;
      phone: string;
      location: string;
      address: string;
      images: string[];
    }>;
    ownedParts: Array<{
      id: string;
      title: string;
      brand?: string;
      model?: string;
      year?: number;
      price: string;
      location: string;
      phone: string;
      images: string[];
    }>;
    ownedDismantlers: Array<{
      id: string;
      brand: string;
      model: string;
      yearFrom: number;
      yearTo: number;
      phone: string;
      location: string;
      photos: string[];
    }>;
  }> {
    const { userId, phone, make, model, year, debug } = params;

    let effectivePhone = phone;
    if (!effectivePhone) {
      const u = await this.userModel.findOne({ id: userId }).lean().exec();
      effectivePhone = u?.phone;
    }

    const storeFilter: Record<string, any> = effectivePhone
      ? { $or: [{ ownerId: userId }, { phone: effectivePhone }] }
      : { ownerId: userId };
    const partFilter: Record<string, any> = {
      $or: [{ seller: userId }, { ownerId: userId }],
    };
    // Match dismantlers by ownerId OR phone (fallback, როგორც მაღაზიებში)
    const dismantlerFilter: Record<string, any> = effectivePhone
      ? { $or: [{ ownerId: userId }, { phone: effectivePhone }] }
      : { ownerId: userId };

    const [stores, parts, dismantlers, storeDocs, partDocs, dismantlerDocs] =
      await Promise.all([
        this.storeModel.countDocuments(storeFilter),
        this.partModel.countDocuments(partFilter),
        this.dismantlerModel.countDocuments(dismantlerFilter),
        this.storeModel
          .find(storeFilter)
          .sort({ createdAt: -1 })
          .limit(20)
          .lean()
          .exec(),
        this.partModel
          .find(partFilter)
          .sort({ createdAt: -1 })
          .limit(20)
          .lean()
          .exec(),
        this.dismantlerModel
          .find(dismantlerFilter)
          .sort({ createdAt: -1 })
          .limit(20)
          .lean()
          .exec(),
      ]);

    if (debug) {
      console.log('[AI] seller-status counts', {
        userId,
        phone: effectivePhone,
        stores,
        parts,
        dismantlers,
      });
    }

    let matchingRequests: Request[] = [];

    const orPredicates: any[] = [];

    const buildFlexRegex = (text: string) => {
      const escaped = this.escapeRegExp(text || '');
      const flexible = escaped
        .replace(/\\s\+/g, '\\s*')
        .replace(/-/g, '[-\\s]?')
        .replace(/\s/g, '\\s*');
      return new RegExp(flexible, 'i');
    };

    for (const p of partDocs || []) {
      const pred: any = {
        'vehicle.make': buildFlexRegex(p.brand || ''),
        'vehicle.model': buildFlexRegex(p.model || ''),
      };
      if (p.year) {
        const yStr = String(p.year);
        const yNum = parseInt(yStr);
        pred['vehicle.year'] = {
          $in: [yStr, Number.isFinite(yNum) ? yNum : yStr],
        };
      }
      if (p.brand && p.model && p.model.trim()) {
        orPredicates.push(pred);
      }
    }

    // Dismantlers: brand + model + year within [yearFrom, yearTo]
    for (const d of dismantlerDocs || []) {
      if (!d.brand || !d.model) continue;
      const years: string[] = [];
      if (Number.isFinite(d.yearFrom) && Number.isFinite(d.yearTo)) {
        const start = Math.min(d.yearFrom, d.yearTo);
        const end = Math.max(d.yearFrom, d.yearTo);
        for (let y = start; y <= end; y++) years.push(String(y));
      }
      const pred: any = {
        'vehicle.make': buildFlexRegex(d.brand),
        'vehicle.model': buildFlexRegex(d.model),
      };
      if (years.length > 0) {
        const yearsNum = years
          .map((ys) => parseInt(ys))
          .filter((yn) => Number.isFinite(yn));
        pred['vehicle.year'] = { $in: [...years, ...yearsNum] };
      }
      orPredicates.push(pred);
    }

    if (orPredicates.length === 0 && make && model && year) {
      orPredicates.push({
        'vehicle.make': new RegExp(`^${this.escapeRegExp(make)}$`, 'i'),
        'vehicle.model': new RegExp(`^${this.escapeRegExp(model)}$`, 'i'),
        'vehicle.year': String(year),
      });
    }

    if (orPredicates.length > 0) {
      // 1) DB query
      let dbDocs: any[] = [];
      try {
        dbDocs = await this.requestModel
          .find({ status: 'active', $or: orPredicates })
          .sort({ createdAt: -1 })
          .limit(200)
          .lean()
          .exec();
      } catch {}

      // 2) In-memory robust filter (always compute), then prefer non-empty
      const allActive = await this.requestModel
        .find({ status: 'active' })
        .sort({ createdAt: -1 })
        .limit(500)
        .lean()
        .exec();

      const normalize = (v: any) => (v ?? '').toString().trim();
      const yearToInt = (v: any) => {
        const n = parseInt((v ?? '').toString());
        return Number.isFinite(n) ? n : undefined;
      };
      const matches = (req: any) => {
        const make = normalize(req?.vehicle?.make);
        const model = normalize(req?.vehicle?.model);
        const yearStr = normalize(req?.vehicle?.year);
        const yearNum = yearToInt(yearStr);

        const partsOk = (partDocs || []).some((p: any) => {
          const brandOk = buildFlexRegex(normalize(p?.brand)).test(make);
          const modelOk = buildFlexRegex(normalize(p?.model)).test(model);
          if (!brandOk || !modelOk) return false;
          if (p?.year) {
            const py = yearToInt(p.year);
            return yearStr === String(p.year) || (py && yearNum === py);
          }
          return true;
        });

        const dismantlersOk = (dismantlerDocs || []).some((d: any) => {
          const brandOk = buildFlexRegex(normalize(d?.brand)).test(make);
          const modelOk = buildFlexRegex(normalize(d?.model)).test(model);
          if (!brandOk || !modelOk) return false;
          if (!Number.isFinite(d?.yearFrom) || !Number.isFinite(d?.yearTo))
            return false;
          const from = Math.min(d.yearFrom, d.yearTo);
          const to = Math.max(d.yearFrom, d.yearTo);
          if (Number.isFinite(yearNum))
            return (yearNum as number) >= from && (yearNum as number) <= to;
          return [from, to].map(String).includes(yearStr);
        });

        return partsOk || dismantlersOk;
      };

      const memDocs = (allActive || []).filter(matches).slice(0, 200);

      const chosen = memDocs.length > 0 ? memDocs : dbDocs;
      if (debug) {
        try {
          console.log(
            '[AI] matched request ids (chosen)',
            chosen.map((r: any) => r._id || r.id),
          );
        } catch {}
      }
      matchingRequests = chosen as unknown as Request[];
    }

    return {
      showSellerPanel: stores + parts + dismantlers > 0,
      counts: { stores, parts, dismantlers },
      matchingRequests,
      ownedStores: (storeDocs || []).map((s: any) => ({
        id: String(s._id || s.id),
        title: s.title,
        type: s.type,
        phone: s.phone,
        location: s.location,
        address: s.address,
        images: Array.isArray(s.images) ? s.images : [],
      })),
      ownedParts: (partDocs || []).map((p: any) => ({
        id: String(p._id || p.id),
        title: p.title,
        brand: p.brand,
        model: p.model,
        year:
          typeof p.year === 'number'
            ? p.year
            : p.year
              ? parseInt(String(p.year))
              : undefined,
        price: p.price,
        location: p.location,
        phone: p.phone,
        images: Array.isArray(p.images) ? p.images : [],
      })),
      ownedDismantlers: (dismantlerDocs || []).map((d: any) => ({
        id: String(d._id || d.id),
        brand: d.brand,
        model: d.model,
        yearFrom: d.yearFrom,
        yearTo: d.yearTo,
        phone: d.phone,
        location: d.location,
        photos: Array.isArray(d.photos) ? d.photos : [],
      })),
    };
  }

  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  generateAIExplanation(
    recommendations: AIRecommendation[],
    request: PartsRequest,
  ): string {
    if (recommendations.length === 0) {
      return `ვერ ვიპოვე ზუსტი შესატყვისი ${request.partName} ნაწილი ${request.vehicle.make} ${request.vehicle.model}-ისთვის. გთხოვთ სცადოთ სხვა ნაწილის დასახელება ან დაუკავშირდით პარტნიორებს.`;
    }

    const topRecommendation = recommendations[0];
    const highConfidenceCount = recommendations.filter(
      (r) => r.confidence > 0.7,
    ).length;
    const totalParts = recommendations.filter((r) => r.type === 'part').length;
    const totalStores = recommendations.filter(
      (r) => r.type === 'store',
    ).length;
    const totalDismantlers = recommendations.filter(
      (r) => r.type === 'dismantler',
    ).length;

    let explanation = `🎯 ${request.partName} ნაწილისთვის ${request.vehicle.make} ${request.vehicle.model} მოდელისთვის ვიპოვე ${recommendations.length} რეკომენდაცია:\n\n`;

    if (topRecommendation.confidence > 0.8) {
      explanation += `✨ ყველაზე მაღალი ხარისხის შეთავაზება: ${topRecommendation.name} (${Math.round(topRecommendation.confidence * 100)}% ემთხვევა)\n`;
      if (topRecommendation.matchReasons.length > 0) {
        explanation += `📋 მიზეზები: ${topRecommendation.matchReasons.slice(0, 2).join(', ')}\n`;
      }
    }

    if (highConfidenceCount > 1) {
      explanation += `\n🔥 ${highConfidenceCount} მაღალი ხარისხის შეთავაზება ნაპოვნია\n`;
    }

    if (totalParts > 0) {
      explanation += `\n🔧 ${totalParts} ზუსტი ნაწილი ხელმისაწვდომია\n`;
    }
    if (totalStores > 0) {
      explanation += `🏪 ${totalStores} მაღაზია შეიძლება შეგვეძლოს ეს ნაწილი\n`;
    }
    if (totalDismantlers > 0) {
      explanation += `🚗 ${totalDismantlers} დაშლილი მანქანა შეიძლება შეგვეძლოს ეს ნაწილი\n`;
    }

    explanation += `\n💡 რეკომენდაცია: ${topRecommendation.confidence > 0.7 ? 'უპირველეს ყოვლისა გაითვალისწინეთ მაღალი ხარისხის შეთავაზებები' : 'შეადარეთ ყველა შეთავაზება და აირჩიეთ ყველაზე შესაფერისი'}`;

    return explanation;
  }

  private async findMatchingParts(
    vehicle: PartsRequest['vehicle'],
    partName: string,
    location?: string,
  ): Promise<AIRecommendation[]> {
    const searchRegex = new RegExp(partName, 'i');
    const brandRegex = new RegExp(vehicle.make, 'i');
    const modelRegex = new RegExp(vehicle.model, 'i');

    const query: Record<string, any> = {
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
      ],
      status: 'active',
    };

    // If location is specified, filter by location
    if (location) {
      query.location = new RegExp(location, 'i');
    }

    const parts = await this.partModel.find(query).exec();

    return parts.map((part) => {
      let confidence = 0.3; // Base confidence for part name match
      const matchReasons: string[] = [];

      // Check if brand matches
      if (part.brand && brandRegex.test(part.brand)) {
        confidence += 0.4;
        matchReasons.push(`ბრენდი ემთხვევა: ${part.brand}`);
      }

      // Check if model matches
      if (part.model && modelRegex.test(part.model)) {
        confidence += 0.3;
        matchReasons.push(`მოდელი ემთხვევა: ${part.model}`);
      }

      // Check if submodel matches
      if (
        vehicle.submodel &&
        part.submodel &&
        part.submodel.toLowerCase() === vehicle.submodel.toLowerCase()
      ) {
        confidence += 0.2;
        matchReasons.push(`ქვემოდელი ემთხვევა: ${part.submodel}`);
      }

      // Check year match
      if (part.year && vehicle.year) {
        const partYear =
          typeof part.year === 'number'
            ? part.year
            : parseInt(String(part.year));
        const requestYear = parseInt(vehicle.year);
        if (Math.abs(partYear - requestYear) <= 2) {
          confidence += 0.2;
          matchReasons.push(`წელი ემთხვევა: ${part.year}`);
        }
      }

      return {
        id: String(part._id),
        type: 'part' as const,
        name: part.title,
        description: part.description,
        location: part.location,
        phone: part.phone,
        confidence: Math.min(confidence, 1.0),
        matchReasons,
        price: part.price,
        images: part.images,
      };
    });
  }

  private async findMatchingStores(
    vehicle: PartsRequest['vehicle'],
    partName: string,
    location?: string,
  ): Promise<AIRecommendation[]> {
    const brandRegex = new RegExp(vehicle.make, 'i');
    const modelRegex = new RegExp(vehicle.model, 'i');

    const query: Record<string, any> = {
      type: { $in: ['ავტონაწილები', 'სამართ-დასახურებელი'] }, // Auto parts or service stores
    };

    if (location) {
      query.location = new RegExp(location, 'i');
    }

    const stores = await this.storeModel.find(query).exec();

    return stores.map((store) => {
      let confidence = 0.2; // Base confidence for store type
      const matchReasons: string[] = [];

      // Check if store specializes in this brand (from specializations)
      if (store.specializations) {
        const hasBrandSpecialization = store.specializations.some((spec) =>
          brandRegex.test(spec),
        );
        if (hasBrandSpecialization) {
          confidence += 0.4;
          matchReasons.push(`მაღაზია სპეციალიზდება ${vehicle.make}-ზე`);
        }
      }

      // Check if store name contains brand/model
      if (brandRegex.test(store.name) || brandRegex.test(store.title)) {
        confidence += 0.3;
        matchReasons.push(`მაღაზიის სახელში არის ${vehicle.make}`);
      }

      if (modelRegex.test(store.name) || modelRegex.test(store.title)) {
        confidence += 0.2;
        matchReasons.push(`მაღაზიის სახელში არის ${vehicle.model}`);
      }

      return {
        id: String(store._id),
        type: 'store' as const,
        name: store.name,
        description: store.description,
        location: store.location,
        phone: store.phone,
        confidence: Math.min(confidence, 1.0),
        matchReasons,
        images: store.images,
      };
    });
  }

  /**
   * Helper function to normalize brand/model strings for matching
   * Removes extra spaces, converts to lowercase, handles special characters
   */
  private normalizeForMatching(str: string): string {
    return (str || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[-_]/g, ' ') // Dashes and underscores to spaces
      .trim();
  }

  /**
   * Helper function to create flexible RegExp for brand/model matching
   * Handles variations like "Porsche Macan" vs "Porsche" + "Macan"
   */
  private createFlexibleRegex(text: string): RegExp | null {
    if (!text || !text.trim()) return null;
    const normalized = this.normalizeForMatching(text);
    // Escape special regex characters but allow flexible matching
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow optional spaces and dashes
    const flexible = escaped.replace(/\s+/g, '[\\s\\-]*');
    return new RegExp(`^${flexible}$`, 'i');
  }

  private async findMatchingDismantlers(
    vehicle: PartsRequest['vehicle'],
    partName: string,
    location?: string,
  ): Promise<AIRecommendation[]> {
    // Build query with proper RegExp
    // Include all statuses: pending (default), approved, active
    // Users add dismantlers with status: 'pending' by default
    const query: Record<string, any> = {
      $or: [
        { status: 'pending' }, // Default status when users add dismantlers
        { status: 'approved' },
        { status: 'active' },
        { status: { $exists: false } }, // Backward compatibility
      ],
    };

    // Add brand match if provided - use flexible matching
    if (vehicle.make && vehicle.make.trim()) {
      const brandRegex = this.createFlexibleRegex(vehicle.make);
      if (brandRegex) {
        query.brand = brandRegex;
      }
    }

    // Add model match if provided - use flexible matching
    if (vehicle.model && vehicle.model.trim()) {
      const modelRegex = this.createFlexibleRegex(vehicle.model);
      if (modelRegex) {
        query.model = modelRegex;
      }
    }

    // Add year range if provided
    if (vehicle.year) {
      const requestYear = parseInt(String(vehicle.year));
      if (!Number.isNaN(requestYear)) {
        query.$and = [
          { yearFrom: { $lte: requestYear } },
          { yearTo: { $gte: requestYear } },
        ];
      }
    }

    if (location && location.trim()) {
      query.location = new RegExp(location.trim(), 'i');
    }

    // Log query with RegExp details
    const queryForLog = { ...query };
    if (queryForLog.brand instanceof RegExp) {
      queryForLog.brand = `RegExp(${queryForLog.brand.source}, ${queryForLog.brand.flags})`;
    }
    if (queryForLog.model instanceof RegExp) {
      queryForLog.model = `RegExp(${queryForLog.model.source}, ${queryForLog.model.flags})`;
    }
    console.log(
      '🔍 [AI] Dismantler query:',
      JSON.stringify(queryForLog, null, 2),
    );
    console.log('🔍 [AI] Vehicle:', {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
    });
    console.log(
      '🔍 [AI] Query has brand:',
      !!query.brand,
      'model:',
      !!query.model,
    );

    // Debug: Check total dismantlers with this brand/model in DB
    const debugQuery = {
      brand: query.brand,
      model: query.model,
    };
    const allMatchingBrandModel = await this.dismantlerModel
      .find(debugQuery)
      .select({ brand: 1, model: 1, status: 1, yearFrom: 1, yearTo: 1 })
      .lean();
    console.log(
      `🔍 [AI] Total dismantlers with brand/model match (any status): ${allMatchingBrandModel.length}`,
    );
    if (allMatchingBrandModel.length > 0) {
      console.log(
        `🔍 [AI] Status breakdown:`,
        allMatchingBrandModel.reduce((acc: any, d: any) => {
          const status = d.status || 'no-status';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
      );
    }

    const dismantlers = await this.dismantlerModel.find(query).exec();
    console.log(
      `🔍 [AI] Found ${dismantlers.length} dismantlers matching full query`,
    );

    // Use flexible matching for confidence calculation
    const brandRegex = vehicle.make
      ? this.createFlexibleRegex(vehicle.make)
      : null;
    const modelRegex = vehicle.model
      ? this.createFlexibleRegex(vehicle.model)
      : null;

    return dismantlers.map((dismantler) => {
      let confidence = 0;
      const matchReasons: string[] = [];

      // Check brand match with flexible matching
      const dismantlerBrandNorm = this.normalizeForMatching(
        dismantler.brand || '',
      );
      const requestBrandNorm = vehicle.make
        ? this.normalizeForMatching(vehicle.make)
        : '';

      if (requestBrandNorm && dismantlerBrandNorm) {
        if (dismantlerBrandNorm === requestBrandNorm) {
          confidence += 0.5; // Exact match
          matchReasons.push(`ბრენდი ზუსტად ემთხვევა: ${dismantler.brand}`);
        } else if (
          dismantlerBrandNorm.includes(requestBrandNorm) ||
          requestBrandNorm.includes(dismantlerBrandNorm)
        ) {
          confidence += 0.4; // Partial match
          matchReasons.push(`ბრენდი ნაწილობრივ ემთხვევა: ${dismantler.brand}`);
        } else if (brandRegex && brandRegex.test(dismantler.brand)) {
          confidence += 0.4; // Regex match
          matchReasons.push(`ბრენდი ემთხვევა: ${dismantler.brand}`);
        }
      }

      // Check model match with flexible matching
      const dismantlerModelNorm = this.normalizeForMatching(
        dismantler.model || '',
      );
      const requestModelNorm = vehicle.model
        ? this.normalizeForMatching(vehicle.model)
        : '';

      if (requestModelNorm && dismantlerModelNorm) {
        if (dismantlerModelNorm === requestModelNorm) {
          confidence += 0.3; // Exact match
          matchReasons.push(`მოდელი ზუსტად ემთხვევა: ${dismantler.model}`);
        } else if (
          dismantlerModelNorm.includes(requestModelNorm) ||
          requestModelNorm.includes(dismantlerModelNorm)
        ) {
          confidence += 0.2; // Partial match
          matchReasons.push(`მოდელი ნაწილობრივ ემთხვევა: ${dismantler.model}`);
        } else if (modelRegex && modelRegex.test(dismantler.model)) {
          confidence += 0.2; // Regex match
          matchReasons.push(`მოდელი ემთხვევა: ${dismantler.model}`);
        }
      }

      // Check year range
      if (vehicle.year) {
        const requestYear = parseInt(String(vehicle.year));
        if (
          !Number.isNaN(requestYear) &&
          requestYear >= dismantler.yearFrom &&
          requestYear <= dismantler.yearTo
        ) {
          confidence += 0.3;
          matchReasons.push(
            `წელი ემთხვევა: ${dismantler.yearFrom}-${dismantler.yearTo}`,
          );
        }
      }

      return {
        id: String(dismantler._id),
        type: 'dismantler' as const,
        name: dismantler.name,
        description: dismantler.description,
        location: dismantler.location,
        phone: dismantler.phone,
        confidence: Math.min(confidence, 1.0),
        matchReasons,
        images: dismantler.photos,
      };
    });
  }
}
