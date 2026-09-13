import { FUEL_CASHBACK_TETRI } from './cashback-policy';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({ timestamps: true })
export class CashbackInvoice {
  @Prop({ required: true, unique: true }) id: string;
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true, unique: true, select: false }) fileHash: string;
  // Kept inside the private database, never uploaded to the public image bucket.
  @Prop({ required: true, type: Buffer, select: false }) file: Buffer;
  @Prop({ required: true }) mimeType: string;
  @Prop({ required: true }) fileName: string;
  @Prop({ enum: ['pending', 'approved', 'rejected'], default: 'pending' }) status: string;
  @Prop({ default: FUEL_CASHBACK_TETRI }) rateTetri: number;
  @Prop() verifiedLiters?: number;
  @Prop() amountTetri?: number;
  @Prop() reviewedAt?: Date;
  @Prop() reviewedBy?: string;
  @Prop() rejectionReason?: string;
  @Prop({ unique: true, sparse: true }) receiptKey?: string;
  createdAt: Date;
}
export const CashbackInvoiceSchema = SchemaFactory.createForClass(CashbackInvoice);
CashbackInvoiceSchema.index({ userId: 1, createdAt: -1 });
CashbackInvoiceSchema.index({ status: 1, createdAt: -1 });
