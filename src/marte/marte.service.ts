import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MarteOrder, MarteOrderDocument } from '../schemas/marte-order.schema';
import {
  MarteAssistant,
  MarteAssistantDocument,
} from '../schemas/marte-assistant.schema';
import { CreateMarteOrderDto } from './dto/create-marte-order.dto';

@Injectable()
export class MarteService {
  constructor(
    @InjectModel(MarteOrder.name)
    private marteOrderModel: Model<MarteOrderDocument>,
    @InjectModel(MarteAssistant.name)
    private marteAssistantModel: Model<MarteAssistantDocument>,
  ) {}

  async createOrder(
    userId: string,
    createOrderDto: CreateMarteOrderDto,
  ): Promise<MarteOrder> {
    const order = new this.marteOrderModel({
      userId,
      ...createOrderDto,
      status: 'pending',
    });

    const savedOrder = await order.save();

    // Start searching for assistant
    void this.searchForAssistant((savedOrder as any)._id.toString());

    return savedOrder;
  }

  async getUserOrders(userId: string): Promise<MarteOrder[]> {
    return this.marteOrderModel.find({ userId }).sort({ createdAt: -1 });
  }

  async getOrderById(orderId: string): Promise<MarteOrder> {
    const order = await this.marteOrderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
    assistantInfo?: any,
  ): Promise<MarteOrder> {
    const updateData: any = { status };

    if (assistantInfo) {
      updateData.assignedAssistant = assistantInfo;
      updateData.actualStartTime = new Date();
    }

    const order = await this.marteOrderModel.findByIdAndUpdate(
      orderId,
      updateData,
      { new: true },
    );

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancelOrder(orderId: string): Promise<MarteOrder> {
    const order = await this.marteOrderModel.findByIdAndUpdate(
      orderId,
      { status: 'cancelled' },
      { new: true },
    );

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async completeOrder(
    orderId: string,
    rating?: number,
    review?: string,
  ): Promise<MarteOrder> {
    const order = await this.marteOrderModel.findByIdAndUpdate(
      orderId,
      {
        status: 'completed',
        actualEndTime: new Date(),
        rating,
        review,
      },
      { new: true },
    );

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Update assistant rating
    if (rating && order.assignedAssistant) {
      await this.updateAssistantRating(order.assignedAssistant.id, rating);
    }

    return order;
  }

  async getAvailableAssistants(
    level: string,
    _location: string,
  ): Promise<MarteAssistant[]> {
    return this.marteAssistantModel
      .find({
        status: 'available',
        'level.id': level,
      })
      .limit(10);
  }

  private searchForAssistant(orderId: string): void {
    // For manual assignment - just log that order is ready for assignment
    setTimeout(() => {
      void (async () => {
        try {
          const order = await this.marteOrderModel.findById(orderId);
          if (!order || order.status !== 'pending') return;

          // Update status to searching (ready for manual assignment)
          await this.marteOrderModel.findByIdAndUpdate(orderId, {
            status: 'searching',
          });

          console.log(`🔍 Order ${orderId} is ready for manual assignment`);
          console.log(`📋 Order details:`, {
            userId: order.userId,
            carInfo: order.carInfo,
            assistantLevel: order.assistantLevel,
            location: order.contactInfo.location,
            problem: order.problemDescription,
          });
        } catch (error) {
          console.error('Error in searchForAssistant:', error);
        }
      })();
    }, 1000); // 1 second delay to simulate processing
  }

  private async updateAssistantRating(
    assistantId: string,
    newRating: number,
  ): Promise<void> {
    const assistant = await this.marteAssistantModel.findById(assistantId);
    if (assistant) {
      const totalRatings = assistant.totalRatings + 1;
      const currentTotal = assistant.rating * assistant.totalRatings;
      const newAverageRating = (currentTotal + newRating) / totalRatings;

      await this.marteAssistantModel.findByIdAndUpdate(assistantId, {
        rating: Math.round(newAverageRating * 10) / 10,
        totalRatings,
        completedOrders: assistant.completedOrders + 1,
      });
    }
  }

  private calculateEstimatedTime(level: string): string {
    const timeMap = {
      standard: '15-30 წუთი',
      premium: '30-45 წუთი',
      elite: '45-60 წუთი',
    };
    return timeMap[level] || '30-45 წუთი';
  }

  // Assistant management methods
  async createAssistant(assistantData: any): Promise<MarteAssistant> {
    const assistant = new this.marteAssistantModel(assistantData);
    return assistant.save();
  }

  async getAllAssistants(): Promise<MarteAssistant[]> {
    return this.marteAssistantModel.find().sort({ rating: -1 });
  }

  async getAssistantById(assistantId: string): Promise<MarteAssistant> {
    const assistant = await this.marteAssistantModel.findById(assistantId);
    if (!assistant) {
      throw new NotFoundException('Assistant not found');
    }
    return assistant;
  }

  async updateAssistantStatus(
    assistantId: string,
    status: string,
  ): Promise<MarteAssistant> {
    const assistant = await this.marteAssistantModel.findByIdAndUpdate(
      assistantId,
      { status },
      { new: true },
    );

    if (!assistant) {
      throw new NotFoundException('Assistant not found');
    }

    return assistant;
  }

  async assignAssistant(
    orderId: string,
    assistantId: string,
    assistantInfo: any,
  ): Promise<MarteOrder> {
    const order = await this.marteOrderModel.findByIdAndUpdate(
      orderId,
      {
        status: 'assigned',
        assignedAssistant: assistantInfo,
        estimatedTime: this.calculateEstimatedTime(
          assistantInfo.level?.id || 'standard',
        ),
        actualStartTime: new Date(),
      },
      { new: true },
    );

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Update assistant status to busy
    await this.marteAssistantModel.findByIdAndUpdate(assistantId, {
      status: 'busy',
    });

    console.log(`✅ Order ${orderId} assigned to assistant ${assistantId}`);
    return order;
  }

  async resetToSearching(orderId: string): Promise<MarteOrder> {
    const order = await this.marteOrderModel.findByIdAndUpdate(
      orderId,
      {
        status: 'searching',
        assignedAssistant: undefined,
        estimatedTime: undefined,
        actualStartTime: undefined,
      },
      { new: true },
    );

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    console.log(`🔄 Order ${orderId} reset to searching status`);
    return order;
  }
}
