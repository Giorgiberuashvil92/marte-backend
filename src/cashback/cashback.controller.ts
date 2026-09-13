import { Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserSessionGuard } from '../auth/user-session';
import { PanelJwtGuard } from '../panel-admin/panel-jwt.guard';
import { CashbackService, MAX_INVOICE_BYTES } from './cashback.service';
const pageNumber = (page?: string) => Math.min(10000, Math.max(0, Math.floor(Number(page) || 0)));
function sendFile(res: Response, invoice: any) {
  res.set({ 'Content-Type': invoice.mimeType, 'Content-Disposition': `attachment; filename="${invoice.fileName}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  return res.send(Buffer.from(invoice.file));
}
@Controller('cashback')
@UseGuards(UserSessionGuard)
export class CashbackController {
  constructor(private service: CashbackService) {}
  @Get('summary') summary(@Req() req: any) { return this.service.summary(req.cashbackUserId); }
  @Get('invoices') list(@Req() req: any, @Query('page') page?: string) { return this.service.list(req.cashbackUserId, pageNumber(page)); }
  @Post('invoices')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_INVOICE_BYTES, files: 1, fields: 0 } }))
  submit(@Req() req: any, @UploadedFile() file?: Express.Multer.File) { return this.service.submit(req.cashbackUserId, file); }
  @Get('invoices/:id/file') async file(@Req() req: any, @Param('id') id: string, @Res() res: Response) { return sendFile(res, await this.service.file(id, req.cashbackUserId)); }
}
@Controller('cashback-admin')
@UseGuards(PanelJwtGuard)
export class CashbackAdminController {
  constructor(private service: CashbackService) {}
  @Get('invoices') list(@Query('page') page?: string, @Query('status') status?: string) { return this.service.list(undefined, pageNumber(page), status); }
  @Post('invoices/:id/review') review(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.review(id, req.panelUser.sub, body); }
  @Get('invoices/:id/file') async file(@Param('id') id: string, @Res() res: Response) { return sendFile(res, await this.service.file(id)); }
}
