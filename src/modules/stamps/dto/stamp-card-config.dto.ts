import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertStampCardConfigDto {
  @IsBoolean()
  isActive: boolean;

  @IsInt()
  @Min(1)
  @Max(10)
  stampsPerOrder: number;

  @IsInt()
  @Min(2)
  @Max(100)
  rewardThreshold: number;

  @IsString()
  @IsOptional()
  rewardDescription?: string;
}
