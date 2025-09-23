import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';

export type MessageCreateDto = {
  offerId: string;
  author: 'user' | 'partner';
  text: string;
};

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async create(dto: MessageCreateDto) {
    const now = Date.now();
    const doc = new this.messageModel({
      ...dto,
      createdAt: now,
      updatedAt: now,
    });
    return doc.save();
  }

  async listByOffer(offerId: string) {
    return this.messageModel.find({ offerId }).sort({ createdAt: 1 }).exec();
  }
}
