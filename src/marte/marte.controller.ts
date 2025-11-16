import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { MarteService } from './marte.service';
import { CreateMarteOrderDto } from './dto/create-marte-order.dto';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    uid?: string;
  };
}

@Controller('marte')
export class MarteController {
  constructor(private readonly marteService: MarteService) {}

  @Post('orders')
  async createOrder(
    @Request() req: AuthenticatedRequest,
    @Body() createOrderDto: CreateMarteOrderDto,
  ) {
    const userId = req.user?.id || req.user?.uid;
    if (!userId || userId === 'demo-user') {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.marteService.createOrder(userId, createOrderDto);
  }

  @Get('orders/my')
  async getUserOrders(@Request() req: AuthenticatedRequest) {
    const userId = req.user?.id || req.user?.uid;
    if (!userId || userId === 'demo-user') {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.marteService.getUserOrders(userId);
  }

  @Get('orders/:id')
  async getOrderById(@Param('id') id: string) {
    return this.marteService.getOrderById(id);
  }

  @Put('orders/:id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { status: string; assistantInfo?: any },
  ) {
    return this.marteService.updateOrderStatus(
      id,
      body.status,
      body.assistantInfo,
    );
  }

  @Put('orders/:id/cancel')
  async cancelOrder(@Param('id') id: string) {
    return this.marteService.cancelOrder(id);
  }

  @Put('orders/:id/complete')
  async completeOrder(
    @Param('id') id: string,
    @Body() body: { rating?: number; review?: string },
  ) {
    return this.marteService.completeOrder(id, body.rating, body.review);
  }

  @Put('orders/:id/assign')
  async assignAssistant(
    @Param('id') id: string,
    @Body() body: { assistantId: string; assistantInfo: any },
  ) {
    return this.marteService.assignAssistant(
      id,
      body.assistantId,
      body.assistantInfo,
    );
  }

  @Put('orders/:id/reset-to-searching')
  async resetToSearching(@Param('id') id: string) {
    return this.marteService.resetToSearching(id);
  }

  @Get('assistants')
  async getAvailableAssistants(
    @Body() body: { level: string; location: string },
  ) {
    return this.marteService.getAvailableAssistants(body.level, body.location);
  }

  @Get('assistants/all')
  async getAllAssistants() {
    return this.marteService.getAllAssistants();
  }

  @Get('assistants/:id')
  async getAssistantById(@Param('id') id: string) {
    return this.marteService.getAssistantById(id);
  }

  @Post('assistants')
  async createAssistant(@Body() assistantData: any) {
    return this.marteService.createAssistant(assistantData);
  }

  @Put('assistants/:id/status')
  async updateAssistantStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.marteService.updateAssistantStatus(id, body.status);
  }

  // Public endpoints for testing
  @Get('health')
  getHealth() {
    return { status: 'MARTE service is running', timestamp: new Date() };
  }

  @Get('assistant-levels')
  getAssistantLevels() {
    return [
      {
        id: 'standard',
        title: 'STANDARD',
        price: 20,
        description: 'ზოგადი პრობლემები',
        features: ['ძირითადი ხელსაწყოები', 'სწრაფი სერვისი', 'ზოგადი რეპარატი'],
      },
      {
        id: 'premium',
        title: 'PREMIUM',
        price: 30,
        description: 'რთული პრობლემები',
        features: [
          'სპეციალისტები',
          'პროფესიონალური ხელსაწყოები',
          'გამოცდილი ხელოსნები',
        ],
      },
      {
        id: 'elite',
        title: 'ELITE',
        price: 50,
        description: 'მაგისტრები',
        features: ['6 თვე გარანტია', 'VIP სერვისი', 'პრემიუმ მომსახურება'],
      },
    ];
  }
}
