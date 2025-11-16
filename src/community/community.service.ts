/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CommunityPost,
  CommunityPostDocument,
} from '../schemas/community-post.schema';
import { Comment, CommentDocument } from '../schemas/comment.schema';
import { PostLike, PostLikeDocument } from '../schemas/post-like.schema';
import {
  CommentLike,
  CommentLikeDocument,
} from '../schemas/comment-like.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class CommunityService {
  constructor(
    @InjectModel(CommunityPost.name)
    private readonly postModel: Model<CommunityPostDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(PostLike.name)
    private readonly postLikeModel: Model<PostLikeDocument>,
    @InjectModel(CommentLike.name)
    private readonly commentLikeModel: Model<CommentLikeDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private async findUserByAnyId(userId?: string) {
    if (!userId) return null;
    try {
      if (Types.ObjectId.isValid(userId)) {
        const byObject = await this.userModel.findById(userId).exec();
        if (byObject) return byObject;
      }
    } catch {}
    try {
      const byCustom = await this.userModel.findOne({ id: userId }).exec();
      if (byCustom) return byCustom;
    } catch {}
    return null;
  }

  private mapPost(doc: any) {
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
      id: obj.id || obj._id?.toString?.(),
      userId: obj.userId,
      userName: obj.userName, // optional from FE
      userInitial: obj.userInitial, // optional from FE
      postText: obj.content || '',
      postImage:
        Array.isArray(obj.images) && obj.images.length > 0
          ? obj.images[0]
          : undefined,
      postLocation: obj.postLocation, // optional passthrough
      likesCount: typeof obj.likes === 'number' ? obj.likes : 0,
      commentsCount: typeof obj.comments === 'number' ? obj.comments : 0,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
      isLiked: false, // backend currently doesn't track per-user like
    };
  }

  private mapComment(doc: any) {
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
      id: obj.id || obj._id?.toString?.(),
      postId: obj.postId,
      userId: obj.userId,
      userName: obj.userName,
      userInitial: obj.userInitial,
      commentText: obj.content || obj.commentText || obj.text || '',
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }

  async createPost(dto: any) {
    try {
      // Frontend sends: { userId, userName, userInitial, postText, postImage?, postLocation? }
      // Schema expects: { userId, title, content, images?, category, likes, comments, tags?, isActive }
      const postText: string = dto?.postText ?? '';
      const title = postText?.trim()?.slice(0, 60) || 'პოსტი';
      const images = dto?.postImage ? [dto.postImage] : undefined;

      // enrich user name/initial if missing
      let userName: string | undefined = dto?.userName;
      let userInitial: string | undefined = dto?.userInitial;
      if (!userName || !userInitial) {
        const u = await this.findUserByAnyId(dto?.userId);
        if (u) {
          userName =
            userName ||
            (u as any).firstName ||
            (u as any).email ||
            (u as any).phone ||
            'მომხმარებელი';
          userInitial =
            userInitial || (userName as string).charAt(0).toUpperCase();
        }
      }
      if (!userName) userName = 'მომხმარებელი';
      if (!userInitial) userInitial = userName.charAt(0).toUpperCase();

      const payload: Partial<CommunityPost> & Record<string, unknown> = {
        userId: dto?.userId,
        title,
        content: postText || '',
        images,
        category: 'general',
        // counters & flags are defaulted by schema
        isActive: true,
        // keep optional frontend extras for future if needed
        userName,
        userInitial,
        postLocation: dto?.postLocation,
      } as any;

      const post = new this.postModel(payload);
      const saved = await post.save();
      return this.mapPost(saved);
    } catch (err: any) {
      // Surface validation reasons to the client
      const message = err?.message || 'validation_error';
      throw new Error(message);
    }
  }

  async listPosts() {
    const filter: any = { isActive: true };
    const docs = await this.postModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
    // batch enrich user names
    const userIds = Array.from(
      new Set(docs.map((d) => (d as any).userId).filter(Boolean)),
    );
    const objectIds = userIds
      .filter((v) => Types.ObjectId.isValid(v))
      .map((v) => new Types.ObjectId(v));
    const customIds = userIds.filter((v) => !Types.ObjectId.isValid(v));
    const users = userIds.length
      ? await this.userModel
          .find({
            $or: [
              ...(customIds.length ? [{ id: { $in: customIds } }] : []),
              ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
            ],
          })
          .exec()
      : [];
    const mapByCustom = new Map(users.map((u: any) => [u.id, u]));
    const mapByObject = new Map(users.map((u: any) => [String(u._id), u]));
    return docs.map((d: any) => {
      const obj: any = this.mapPost(d) || {};
      const u = mapByCustom.get(d.userId) || mapByObject.get(d.userId);
      if (u) {
        obj.userName = obj.userName || u.firstName || u.email || u.phone || 'მომხმარებელი';
        obj.userInitial = obj.userInitial || (obj.userName ? String(obj.userName).charAt(0).toUpperCase() : '?');
      }
      return obj;
    });
  }

  async getPost(id: string) {
    const doc = await this.postModel.findById(id).exec();
    if (!doc) throw new NotFoundException('post_not_found');
    return this.mapPost(doc);
  }

  async updatePost(id: string, dto: any) {
    const doc = await this.postModel
      .findByIdAndUpdate(id, { ...dto, updatedAt: Date.now() }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('post_not_found');
    return this.mapPost(doc);
  }

  async deletePost(id: string) {
    const res = await this.postModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('post_not_found');
    return { success: true };
  }

  async addComment(dto: any) {
    const now = Date.now();
    const payload = {
      postId: dto?.postId,
      userId: dto?.userId,
      userName: dto?.userName,
      userInitial: dto?.userInitial,
      content: dto?.commentText || dto?.content || '',
      createdAt: now,
      updatedAt: now,
      isActive: true,
    } as any;
    if (!payload.userName || !payload.userInitial) {
      const u = await this.findUserByAnyId(payload.userId);
      if (u) {
        payload.userName =
          payload.userName ||
          (u as any).firstName ||
          (u as any).email ||
          (u as any).phone ||
          'მომხმარებელი';
        payload.userInitial =
          payload.userInitial ||
          (payload.userName as string).charAt(0).toUpperCase();
      }
    }
    if (!payload.userName) payload.userName = 'მომხმარებელი';
    if (!payload.userInitial)
      payload.userInitial = (payload.userName as string)
        .charAt(0)
        .toUpperCase();
    const comment = new this.commentModel(payload);
    const saved = await comment.save();
    return this.mapComment(saved);
  }

  async listComments(postId: string) {
    const docs = await this.commentModel
      .find({ postId, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
    const userIds = Array.from(
      new Set(docs.map((d) => (d as any).userId).filter(Boolean)),
    );
    const objIds = userIds
      .filter((v) => Types.ObjectId.isValid(v))
      .map((v) => new Types.ObjectId(v));
    const custIds = userIds.filter((v) => !Types.ObjectId.isValid(v));
    const users = userIds.length
      ? await this.userModel
          .find({
            $or: [
              ...(custIds.length ? [{ id: { $in: custIds } }] : []),
              ...(objIds.length ? [{ _id: { $in: objIds } }] : []),
            ],
          })
          .exec()
      : [];
    const mapCustom = new Map(users.map((u: any) => [u.id, u]));
    const mapObject = new Map(users.map((u: any) => [String(u._id), u]));
    return docs.map((d: any) => {
      const obj: any = this.mapComment(d) || {};
      const u = mapCustom.get(d.userId) || mapObject.get(d.userId);
      if (u) {
        obj.userName = obj.userName || u.firstName || u.email || u.phone || 'მომხმარებელი';
        obj.userInitial = obj.userInitial || (obj.userName ? String(obj.userName).charAt(0).toUpperCase() : '?');
      }
      return obj;
    });
  }

  // Likes
  async togglePostLike(postId: string, userId: string) {
    if (!postId || !userId) throw new Error('invalid_payload');
    const existing = await this.postLikeModel
      .findOne({ postId, userId })
      .exec();
    if (existing) {
      await this.postLikeModel.deleteOne({ _id: existing._id }).exec();
    } else {
      await new this.postLikeModel({ postId, userId }).save();
    }
    const likesCount = await this.postLikeModel
      .countDocuments({ postId })
      .exec();
    const isLiked = !existing;
    // optionally reflect on post counter
    await this.postModel
      .updateOne({ _id: postId }, { $set: { likes: likesCount } })
      .exec();
    return { isLiked, likesCount };
  }

  async toggleCommentLike(commentId: string, userId: string) {
    if (!commentId || !userId) throw new Error('invalid_payload');
    const existing = await this.commentLikeModel
      .findOne({ commentId, userId })
      .exec();
    if (existing) {
      await this.commentLikeModel.deleteOne({ _id: existing._id }).exec();
    } else {
      await new this.commentLikeModel({ commentId, userId }).save();
    }
    const likesCount = await this.commentLikeModel
      .countDocuments({ commentId })
      .exec();
    const isLiked = !existing;
    return { isLiked, likesCount };
  }

  async listCommentLikes(commentId: string) {
    const docs = await this.commentLikeModel.find({ commentId }).exec();
    return docs.map((d) => (d as any).userId);
  }

  async deleteComment(commentId: string) {
    const res = await this.commentModel.findByIdAndDelete(commentId).exec();
    if (!res) throw new NotFoundException('comment_not_found');
    // Optionally cleanup likes
    await this.commentLikeModel.deleteMany({ commentId }).exec();
    return { success: true };
  }
}
