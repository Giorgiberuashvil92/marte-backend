import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import {
  ExclusiveOfferRequest,
  ExclusiveOfferRequestDocument,
} from '../schemas/exclusive-offer-request.schema';

/** საქართველო UTC+4, DST არა — ISO offset-ით საკმარისია კალენდრული დღის საზღვრებისთვის. */
function tbilisiTodayYmd(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' });
}

function startOfTbilisiDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+04:00`);
}

function addTbilisiCalendarDays(ymd: string, deltaDays: number): string {
  const start = startOfTbilisiDay(ymd);
  const shifted = new Date(start.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return shifted.toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' });
}

/** Mongo pipeline: პირადი № ერთნაირად (სფეისების გარეშე) უნიკალურობისთვის */
const addFieldsPidNorm: PipelineStage = {
  $addFields: {
    pidNorm: {
      $replaceAll: {
        input: {
          $trim: {
            input: { $toString: { $ifNull: ['$personalId', ''] } },
          },
        },
        find: ' ',
        replacement: '',
      },
    },
  },
};

@Injectable()
export class ExclusiveOfferService {
  constructor(
    @InjectModel(ExclusiveOfferRequest.name)
    private readonly model: Model<ExclusiveOfferRequestDocument>,
  ) {}

  async create(payload: {
    firstName: string;
    lastName: string;
    personalId: string;
    phone: string;
    email: string;
    userId?: string;
    source?: string;
  }) {
    const doc = new this.model({
      firstName: payload.firstName,
      lastName: payload.lastName,
      personalId: payload.personalId,
      phone: payload.phone,
      email: payload.email,
      userId: payload.userId,
      source: payload.source || 'fuel_exclusive_portal',
    });
    return doc.save();
  }

  private serializeRow(doc: Record<string, unknown>) {
    const row = { ...doc } as Record<string, unknown>;
    for (const key of ['createdAt', 'updatedAt'] as const) {
      const v = row[key];
      if (v instanceof Date) {
        row[key] = v.toISOString();
      }
    }
    return row;
  }

  /**
   * უნიკალური განმცხადებლები (ნორმალიზებული personalId) — დღეს / გუშინ (თბილისი) + სულ ყველა დროით.
   */
  private async uniqueApplicantStats(): Promise<{
    uniqueUsersToday: number;
    uniqueUsersYesterday: number;
    uniqueUsersAllTime: number;
  }> {
    const now = new Date();
    const todayYmd = tbilisiTodayYmd(now);
    const yesterdayYmd = addTbilisiCalendarDays(todayYmd, -1);

    const dayKeyExpr = {
      $dateToString: {
        format: '%Y-%m-%d',
        date: '$createdAt',
        timezone: 'Asia/Tbilisi',
      },
    };

    const distinctPidStages = (dayKey: string): PipelineStage[] => [
      {
        $match: {
          createdAt: { $exists: true, $ne: null },
        },
      },
      addFieldsPidNorm,
      { $addFields: { dayKey: dayKeyExpr } },
      { $match: { dayKey, pidNorm: { $ne: '' } } },
      { $group: { _id: '$pidNorm' } },
      { $count: 'n' },
    ];

    const allTimeUniqueStages: PipelineStage[] = [
      addFieldsPidNorm,
      { $match: { pidNorm: { $ne: '' } } },
      { $group: { _id: '$pidNorm' } },
      { $count: 'n' },
    ];

    const [todayAgg, yesterdayAgg, allTimeAgg] = await Promise.all([
      this.model.aggregate<{ n: number }>(distinctPidStages(todayYmd)).exec(),
      this.model
        .aggregate<{ n: number }>(distinctPidStages(yesterdayYmd))
        .exec(),
      this.model.aggregate<{ n: number }>(allTimeUniqueStages).exec(),
    ]);

    return {
      uniqueUsersToday: todayAgg[0]?.n ?? 0,
      uniqueUsersYesterday: yesterdayAgg[0]?.n ?? 0,
      uniqueUsersAllTime: allTimeAgg[0]?.n ?? 0,
    };
  }

  async list(params?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
    const offset = Math.max(params?.offset ?? 0, 0);

    const [data, total, stats] = await Promise.all([
      this.model
        .find({})
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments().exec(),
      this.uniqueApplicantStats(),
    ]);

    const dataSerialized = data.map((d) =>
      this.serializeRow(d as Record<string, unknown>),
    );

    return { data: dataSerialized, total, limit, offset, stats };
  }

  async updateById(
    id: string,
    patch: { adminNote?: string; called?: boolean },
  ) {
    const existing = await this.model.findById(id).lean().exec();
    if (!existing) {
      return null;
    }

    const $set: Record<string, unknown> = {};
    if (patch.adminNote !== undefined) {
      $set.adminNote = String(patch.adminNote);
    }
    if (patch.called !== undefined) {
      $set.called = Boolean(patch.called);
    }
    if (Object.keys($set).length === 0) {
      return this.serializeRow(existing as Record<string, unknown>);
    }

    const pid = String(existing.personalId ?? '')
      .trim()
      .replace(/\s/g, '');
    if (pid) {
      await this.model.updateMany({ personalId: pid }, { $set }).exec();
    } else {
      await this.model.findByIdAndUpdate(id, { $set }).exec();
    }

    const fresh = await this.model.findById(id).lean().exec();
    if (!fresh) return null;
    return this.serializeRow(fresh as Record<string, unknown>);
  }
}
