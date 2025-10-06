import { PartialType } from '@nestjs/mapped-types';
import { CreateDismantlerDto } from './create-dismantler.dto';

export class UpdateDismantlerDto extends PartialType(CreateDismantlerDto) {}
