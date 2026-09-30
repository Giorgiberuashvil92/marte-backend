import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PartLeadDocument = PartLead & Document;

@Schema({ timestamps: true })
export class PartLead {
  @Prop()
  userId?: string;

  @Prop({ default: '' })
  userName!: string;

  @Prop({ default: '' })
  userPhone!: string;

  @Prop({ required: true })
  partId!: string;

  @Prop({ required: true })
  partTitle!: string;

  @Prop({ default: '' })
  partPrice!: string;

  @Prop({ default: '' })
  partBrand!: string;

  @Prop({ default: '' })
  partModel!: string;

  @Prop({ default: '' })
  partCategory!: string;

  @Prop({ default: '' })
  partLocation!: string;

  @Prop({ default: '' })
  partImage!: string;

  @Prop({ default: '' })
  note!: string;

  @Prop({ default: 'parts_detail' })
  source!: string;

  @Prop({
    type: String,
    enum: ['new', 'contacted', 'closed'],
    default: 'new',
  })
  status!: string;
}

export const PartLeadSchema = SchemaFactory.createForClass(PartLead);

PartLeadSchema.index({ status: 1, createdAt: -1 });
PartLeadSchema.index({ userId: 1, createdAt: -1 });
PartLeadSchema.index({ partId: 1, createdAt: -1 });

PartLeadSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: any, ret: any) => {
    if (ret && ret._id) {
      ret.id = ret.id || ret._id.toString();
      ret._id = undefined;
    }
    return ret;
  },
});
