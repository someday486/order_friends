import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GetOrdersQueryDto extends PaginationDto {
  @ApiProperty({ description: '지점 ID', required: true })
  @IsString()
  @IsNotEmpty()
  branchId: string;
}
