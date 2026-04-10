import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SupportThreadDocument = SupportThread & Document;

@Schema({ timestamps: true, collection: 'support_threads' })
export class SupportThread {
  /** Marte user id ან guest:uuid — ერთი თრედი ერთ მომხმარებელზე */
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  /**
   * ბოლო დრო, რომლამდეც მომხმარებელმა „ნახა“ თრედი (საუბრის გახსნისას იხსნება).
   * აგენტის შეტყობინებების unread = timestamp > userLastReadAt.
   */
  @Prop({ type: Number, default: 0 })
  userLastReadAt: number;

  /**
   * ახალი თრედები true — unread ნორმალურად ითვლება.
   * ძველი დოკუმენტები (ველი არ ჰქონდათ) — პირველ unread მოთხოვნაზე ერთჯერ ბოლო მესიჯამდე „იჭრება“ რათა ტყუილი ბეიჯი არ აერიოს.
   */
  @Prop({ type: Boolean, default: false })
  supportReadCursorBackfilled: boolean;
}

export const SupportThreadSchema = SchemaFactory.createForClass(SupportThread);
SupportThreadSchema.set('toJSON', { virtuals: true, versionKey: false });
