import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file_required');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('image_required');
    }

    let uploaded: { key: string; url: string };
    try {
      uploaded = await this.uploadsService.uploadImage({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'R2 upload failed';
      console.error('R2 upload failed:', message);
      throw new InternalServerErrorException({
        error: 'r2_upload_failed',
        message,
      });
    }

    return { success: true, data: uploaded };
  }
}
