import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BrandRole, BranchRole } from '../../members/dto/member.dto';

export class InviteCustomerBrandMemberRequest {
  @ApiProperty({ description: '초대할 이메일' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: '브랜드 역할',
    enum: BrandRole,
    default: BrandRole.MEMBER,
  })
  @IsEnum(BrandRole)
  @IsOptional()
  role?: BrandRole = BrandRole.MEMBER;
}

export class InviteCustomerBranchMemberRequest {
  @ApiProperty({ description: '초대할 이메일' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: '매장 역할',
    enum: BranchRole,
    default: BranchRole.STAFF,
  })
  @IsEnum(BranchRole)
  @IsOptional()
  role?: BranchRole = BranchRole.STAFF;
}
