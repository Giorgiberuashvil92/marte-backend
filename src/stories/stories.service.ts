import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Story, StoryDocument } from '../schemas/story.schema';

type ListParams = { category?: string; highlight?: boolean; userId?: string };

@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
  ) {}

  async list(params: ListParams) {
    const filter: Record<string, unknown> = {};
    if (params.category) filter.category = params.category;
    if (typeof params.highlight === 'boolean')
      filter.highlight = params.highlight;
    const docs = await this.storyModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();
    const userId = params.userId;
    return docs.map((d) => {
      const anyDoc = d as unknown as { [k: string]: unknown; _id?: unknown };
      const _id = anyDoc._id as
        | { toString?: () => string }
        | string
        | undefined;
      const id = typeof _id === 'string' ? _id : _id?.toString?.();
      const docWithViewers = anyDoc as { viewers?: Array<{ userId: string }> };
      const viewers = Array.isArray(docWithViewers.viewers)
        ? docWithViewers.viewers
        : [];
      const isSeen = userId ? viewers.some((v) => v.userId === userId) : false;
      return { ...anyDoc, id: String(id), isSeen } as Record<string, unknown>;
    });
  }

  async one(_id: string) {
    const doc = await this.storyModel.findById(_id).lean();
    if (!doc) throw new NotFoundException('story_not_found');
    const anyDoc = doc as unknown as { [k: string]: unknown; _id?: unknown };
    const _idValue = anyDoc._id as
      | { toString?: () => string }
      | string
      | undefined;
    const idStr =
      typeof _idValue === 'string' ? _idValue : _idValue?.toString?.();
    return { ...anyDoc, id: String(idStr) } as Record<string, unknown>;
  }

  async create(body: Partial<Story>) {
    const now = Date.now();
    const payload: Partial<Story> = {
      authorId: body.authorId!,
      authorName: body.authorName!,
      authorAvatar: body.authorAvatar,
      category: body.category || 'services',
      highlight: !!body.highlight,
      items: Array.isArray(body.items) ? body.items : [],
      createdAt: now,
      updatedAt: now,
    };
    const created = await this.storyModel.create(payload);
    const obj = created.toObject() as unknown as {
      [k: string]: unknown;
      _id?: unknown;
    };
    const _id = obj._id as { toString?: () => string } | string | undefined;
    const id = typeof _id === 'string' ? _id : _id?.toString?.();
    return { ...obj, id: String(id) } as Record<string, unknown>;
  }

  async update(_id: string, body: Partial<Story>) {
    const updated = await this.storyModel
      .findByIdAndUpdate(_id, { ...body, updatedAt: Date.now() }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('story_not_found');
    const anyDoc = updated as unknown as {
      [k: string]: unknown;
      _id?: unknown;
    };
    const _idValue = anyDoc._id as
      | { toString?: () => string }
      | string
      | undefined;
    const idStr =
      typeof _idValue === 'string' ? _idValue : _idValue?.toString?.();
    return { ...anyDoc, id: String(idStr) } as Record<string, unknown>;
  }

  async remove(id: string) {
    const res = await this.storyModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('story_not_found');
  }

  async markSeen(storyId: string, userId: string) {
    if (!userId) return { ok: true };
    const now = Date.now();
    const updated = await this.storyModel
      .findOneAndUpdate(
        { _id: storyId, 'viewers.userId': { $ne: userId } },
        {
          $inc: { viewsCount: 1 },
          $push: { viewers: { userId, viewedAt: now } },
          $set: { updatedAt: now },
        },
        { new: true },
      )
      .lean();
    // if already seen, ensure doc exists
    if (!updated) {
      const doc = await this.storyModel.findById(storyId).lean();
      if (!doc) throw new NotFoundException('story_not_found');
      return { ok: true, viewsCount: doc.viewsCount || 0 };
    }
    return { ok: true, viewsCount: updated.viewsCount || 0 };
  }

  async listViews(storyId: string, limit = 50, offset = 0) {
    const doc = (await this.storyModel
      .findById(storyId, { viewers: 1, viewsCount: 1 })
      .lean()) as unknown as {
      viewers?: Array<{ userId: string; viewedAt: number }>;
      viewsCount?: number;
    } | null;
    if (!doc) throw new NotFoundException('story_not_found');
    const viewers: Array<{ userId: string; viewedAt: number }> = Array.isArray(
      doc.viewers,
    )
      ? (doc.viewers as Array<{ userId: string; viewedAt: number }>)
      : [];
    const sorted = [...viewers].sort(
      (a, b) => Number(b?.viewedAt || 0) - Number(a?.viewedAt || 0),
    );
    const paged = sorted.slice(offset, offset + limit);
    return {
      total: viewers.length || 0,
      viewsCount: Number(doc.viewsCount || 0),
      data: paged,
    };
  }
}
