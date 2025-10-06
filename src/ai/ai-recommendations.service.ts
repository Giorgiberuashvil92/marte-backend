import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store, StoreDocument } from '../schemas/store.schema';
import { Dismantler, DismantlerDocument } from '../schemas/dismantler.schema';
import { Part, PartDocument } from '../schemas/part.schema';

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
  ) {}

  async recommendForPartsRequest(
    request: PartsRequest,
  ): Promise<AIRecommendation[]> {
    const { vehicle, partName, location } = request;

    console.log('🤖 AI Recommendations for:', { vehicle, partName, location });

    const recommendations: AIRecommendation[] = [];

    // 1. Search in Parts collection (direct parts)
    const parts = await this.findMatchingParts(vehicle, partName, location);
    recommendations.push(...parts);

    // 2. Search in Stores collection (stores that might have this part)
    const stores = await this.findMatchingStores(vehicle, partName, location);
    recommendations.push(...stores);

    // 3. Search in Dismantlers collection (dismantlers with matching cars)
    const dismantlers = await this.findMatchingDismantlers(
      vehicle,
      partName,
      location,
    );
    recommendations.push(...dismantlers);

    // Sort by confidence score
    const sortedRecommendations = recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20); // Return top 20 recommendations

    console.log(`🤖 Generated ${sortedRecommendations.length} recommendations`);
    return sortedRecommendations;
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

  private async findMatchingDismantlers(
    vehicle: PartsRequest['vehicle'],
    partName: string,
    location?: string,
  ): Promise<AIRecommendation[]> {
    const brandRegex = new RegExp(vehicle.make, 'i');
    const modelRegex = new RegExp(vehicle.model, 'i');

    const query: Record<string, any> = {
      status: 'approved',
      brand: brandRegex,
    };

    if (location) {
      query.location = new RegExp(location, 'i');
    }

    const dismantlers = await this.dismantlerModel.find(query).exec();

    return dismantlers.map((dismantler) => {
      let confidence = 0.4; // Base confidence for brand match
      const matchReasons: string[] = [`ბრენდი ემთხვევა: ${dismantler.brand}`];

      // Check if model matches
      if (modelRegex.test(dismantler.model)) {
        confidence += 0.3;
        matchReasons.push(`მოდელი ემთხვევა: ${dismantler.model}`);
      }

      // Check year range
      if (vehicle.year) {
        const requestYear = parseInt(vehicle.year);
        if (
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
