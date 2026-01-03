import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, RequestDocument } from '../schemas/request.schema';
import { Part, PartDocument } from '../schemas/part.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AIRecommendationsService } from './ai-recommendations.service';
import * as admin from 'firebase-admin';

export interface MatchResult {
  confidence: number;
  matchReasons: string[];
  recommendation: any;
}

@Injectable()
export class AINotificationsService {
  constructor(
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>,
    @InjectModel(Part.name) private partModel: Model<PartDocument>,
    private notificationsService: NotificationsService,
    private aiService: AIRecommendationsService,
  ) {}

  /**
   * გამოთვალე confidence score request-სა და part-ს შორის
   */
  private calculateMatchConfidence(
    part: any,
    request: any,
  ): { confidence: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Make match (30%)
    const partMake = (part.vehicle?.make || part.make || '').toLowerCase();
    const reqMake = (request.vehicle?.make || '').toLowerCase();
    if (partMake === reqMake) {
      score += 0.3;
      reasons.push(`✓ მარკა ემთხვევა: ${partMake}`);
    } else if (partMake.includes(reqMake) || reqMake.includes(partMake)) {
      score += 0.15;
      reasons.push(`~ მარკა ნაწილობრივ ემთხვევა`);
    }

    // Model match (30%)
    const partModel = (part.vehicle?.model || part.model || '').toLowerCase();
    const reqModel = (request.vehicle?.model || '').toLowerCase();
    if (partModel === reqModel) {
      score += 0.3;
      reasons.push(`✓ მოდელი ემთხვევა: ${partModel}`);
    } else if (partModel.includes(reqModel) || reqModel.includes(partModel)) {
      score += 0.15;
      reasons.push(`~ მოდელი ნაწილობრივ ემთხვევა`);
    }

    // Year match (20%)
    const partYear = part.vehicle?.year || part.year;
    const reqYear = request.vehicle?.year;
    if (partYear && reqYear) {
      const yearDiff = Math.abs(parseInt(partYear) - parseInt(reqYear));
      if (yearDiff === 0) {
        score += 0.2;
        reasons.push(`✓ წელი ზუსტად ემთხვევა: ${partYear}`);
      } else if (yearDiff <= 2) {
        score += 0.1;
        reasons.push(`~ წელი ახლოსაა (±${yearDiff} წელი)`);
      }
    }

    // Part name match (20%)
    const partName = (part.name || part.partName || '').toLowerCase();
    const reqPartName = (request.partName || '').toLowerCase();
    if (partName.includes(reqPartName) || reqPartName.includes(partName)) {
      score += 0.2;
      reasons.push(`✓ ნაწილის სახელი ემთხვევა`);
    }

    return { confidence: score, reasons };
  }

  /**
   * როცა ახალი ნაწილი ემატება, შეამოწმე არსებული requests
   */
  async checkMatchingRequestsForNewPart(part: any): Promise<void> {
    console.log('🤖 [AI-NOTIFY] Checking matching requests for new part:', {
      partId: part._id,
      make: part.vehicle?.make || part.make,
      model: part.vehicle?.model || part.model,
      name: part.name,
    });

    try {
      // იპოვე active requests
      const partMake = (part.vehicle?.make || part.make || '').toLowerCase();
      const partModel = (part.vehicle?.model || part.model || '').toLowerCase();

      const matchingRequests = await this.requestModel
        .find({
          status: 'active',
          $or: [
            { 'vehicle.make': new RegExp(partMake, 'i') },
            { 'vehicle.model': new RegExp(partModel, 'i') },
          ],
        })
        .limit(50)
        .lean();

      console.log(
        `🔍 [AI-NOTIFY] Found ${matchingRequests.length} potential matching requests`,
      );

      for (const request of matchingRequests) {
        // მარტივი match ლოგიკა: (year ∈ [2016,2019]) OR (make && model ზუსტი ემთხვევა)
        const reqMake = (request.vehicle?.make || '').toLowerCase();
        const reqModel = (request.vehicle?.model || '').toLowerCase();
        const reqYearNum = parseInt(request.vehicle?.year || '');

        const pMake = (part.vehicle?.make || part.make || '').toLowerCase();
        const pModel = (part.vehicle?.model || part.model || '').toLowerCase();
        const pYearNum = parseInt(part.vehicle?.year || part.year || '');

        const sameBrandModel =
          pMake && pModel && reqMake === pMake && reqModel === pModel;
        const yearInRange =
          Number.isFinite(reqYearNum) &&
          reqYearNum >= 2016 &&
          reqYearNum <= 2019;

        // ასევე დავუშვათ, რომ თუ ორივეს აქვს წელი და განსხვავება მცირეა, ჩავთვალოთ year match-ად დიაპაზონში
        const bothYears =
          Number.isFinite(reqYearNum) && Number.isFinite(pYearNum);
        const yearClose =
          bothYears &&
          Math.abs(reqYearNum - pYearNum) <= 0 &&
          reqYearNum >= 2016 &&
          reqYearNum <= 2019;

        if (sameBrandModel || yearInRange || yearClose) {
          const userId = request.userId?.toString();
          if (!userId) continue;

          const partPrice = part.price || 'ფასი არ არის მითითებული';
          const prettyMake = part.vehicle?.make || part.make || '';
          const prettyModel = part.vehicle?.model || part.model || '';
          const prettyYear = part.vehicle?.year || part.year || '';
          const partName = part.name || part.partName || '';
          const storeName = part.storeName || 'მაღაზია';

          await this.notificationsService.sendPushToTargets(
            [{ userId }],
            {
              title: '✨ ახალი შეთავაზება შენს მოთხოვნაზე',
              body: `${prettyMake} ${prettyModel}${prettyYear ? ' ' + prettyYear : ''} • ${partName} — ${partPrice}₾ • ${storeName}`,
              data: {
                type: 'ai_part_match',
                partId: part._id?.toString(),
                requestId: request._id?.toString(),
                screen: 'PartDetails',
              },
              sound: 'default',
              badge: 1,
            },
            'offer',
          );

          console.log(
            `✅ [AI-NOTIFY] Sent notification to user ${userId} (simple match: brand/model/year)`,
          );
        }
      }
    } catch (error) {
      console.error('❌ [AI-NOTIFY] Error checking matching requests:', error);
    }
  }

  /**
   * როცა ახალი request იქმნება, შეამოწმე არსებული parts
   */
  async checkMatchingPartsForNewRequest(request: any): Promise<void> {
    console.log('🤖 [AI-NOTIFY] Checking matching parts for new request:', {
      requestId: request._id,
      make: request.vehicle?.make,
      model: request.vehicle?.model,
      partName: request.partName,
    });

    try {
      const reqMake = (request.vehicle?.make || '').toLowerCase();
      const reqModel = (request.vehicle?.model || '').toLowerCase();

      // იპოვე შესაბამისი parts
      const matchingParts = await this.partModel
        .find({
          $or: [
            { 'vehicle.make': new RegExp(reqMake, 'i') },
            { 'vehicle.model': new RegExp(reqModel, 'i') },
            { make: new RegExp(reqMake, 'i') },
            { model: new RegExp(reqModel, 'i') },
          ],
        })
        .limit(50)
        .lean();

      console.log(
        `🔍 [AI-NOTIFY] Found ${matchingParts.length} potential matching parts`,
      );

      const highConfidenceMatches: Array<{
        part: any;
        confidence: number;
        reasons: string[];
      }> = [];

      for (const part of matchingParts) {
        const { confidence, reasons } = this.calculateMatchConfidence(
          part,
          request,
        );

        if (confidence >= 0.6) {
          highConfidenceMatches.push({
            part,
            confidence,
            reasons,
          });
        }
      }

      // თუ არის მაღალი confidence-ის matches, გაგზავნე notification
      if (highConfidenceMatches.length > 0) {
        const userId = request.userId?.toString();
        if (!userId) return;

        // დალაგე confidence-ის მიხედვით
        highConfidenceMatches.sort((a, b) => b.confidence - a.confidence);
        const topMatch = highConfidenceMatches[0];

        await this.notificationsService.sendPushToTargets(
          [{ userId }],
          {
            title: '🎯 ვიპოვეთ შესატყვისი ნაწილები',
            body: `${request.vehicle?.make || ''} ${request.vehicle?.model || ''}${request.vehicle?.year ? ' ' + request.vehicle?.year : ''} • ${request.partName} — ${highConfidenceMatches.length} ვარიანტი მზადაა`,
            data: {
              type: 'ai_request_match',
              requestId: request._id?.toString(),
              matchCount: highConfidenceMatches.length.toString(),
              topPartId: topMatch.part._id?.toString(),
              confidence: topMatch.confidence.toString(),
              screen: 'RequestDetails',
            },
            sound: 'default',
            badge: 1,
          },
          'system',
        );

        console.log(
          `✅ [AI-NOTIFY] Sent notification to user ${userId} (${highConfidenceMatches.length} matches found)`,
        );
      }
    } catch (error) {
      console.error('❌ [AI-NOTIFY] Error checking matching parts:', error);
    }
  }

  /**
   * გაგზავნე notification AI recommendations-ის საფუძველზე
   */
  async sendAIRecommendationNotification(
    userId: string,
    request: any,
  ): Promise<void> {
    try {
      const recommendations = await this.aiService.recommendForPartsRequest({
        vehicle: request.vehicle,
        partName: request.partName,
        location: request.location,
      });

      // ფილტრავს მაღალი confidence-ის მქონე recommendations
      // Lowered threshold from 0.7 to 0.5 to catch more matches (brand + model = 0.7, brand only = 0.4)
      const highConfidenceRecs = recommendations.filter(
        (rec) => rec.confidence >= 0.5,
      );

      console.log(
        `🤖 [AI-NOTIFY] Found ${recommendations.length} total recommendations, ${highConfidenceRecs.length} with confidence >= 0.5`,
      );

      if (highConfidenceRecs.length > 0) {
        await this.notificationsService.sendPushToTargets(
          [{ userId }],
          {
            title: '🤖 მომხმარებელს ჭირდება ნაწილი',
            body: `${request.vehicle?.make || ''} ${request.vehicle?.model || ''}${request.vehicle?.year ? ' ' + request.vehicle?.year : ''} • ${request.partName} — ${highConfidenceRecs.length} ვარიანტი`,
            data: {
              type: 'ai_recommendations',
              requestId: request._id?.toString(),
              recommendationCount: highConfidenceRecs.length.toString(),
              topRecommendations: JSON.stringify(
                highConfidenceRecs.slice(0, 3),
              ),
              screen: 'AIRecommendations',
            },
            sound: 'default',
            badge: 1,
          },
          'system',
        );

        console.log(`✅ [AI-NOTIFY] Sent AI recommendations to user ${userId}`);
      }
    } catch (error) {
      console.error('❌ [AI-NOTIFY] Error sending AI recommendations:', error);
    }
  }
}
