import { IsOptional, IsDateString } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class HistoryQueryDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
