import { ApiProperty } from '@nestjs/swagger';

export enum CustomerMemberHistoryAction {
  INVITE_SENT = 'INVITE_SENT',
  ROLE_CHANGED = 'ROLE_CHANGED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  ROLE_STATUS_CHANGED = 'ROLE_STATUS_CHANGED',
}

export enum CustomerMemberHistoryScope {
  BRAND = 'BRAND',
  BRANCH = 'BRANCH',
}

export class CustomerMemberHistoryResponse {
  @ApiProperty({ description: '로그 ID' })
  id: string;

  @ApiProperty({
    enum: CustomerMemberHistoryAction,
    description: '변경 액션 유형',
  })
  actionType: CustomerMemberHistoryAction;

  @ApiProperty({ enum: CustomerMemberHistoryScope, description: '변경 범위' })
  scopeType: CustomerMemberHistoryScope;

  @ApiProperty({ description: '브랜드 ID' })
  brandId: string;

  @ApiProperty({ description: '매장 ID', nullable: true, required: false })
  branchId?: string | null;

  @ApiProperty({ description: '작업자 사용자 ID' })
  actorUserId: string;

  @ApiProperty({ description: '작업자 이름', nullable: true, required: false })
  actorDisplayName?: string | null;

  @ApiProperty({
    description: '작업자 이메일',
    nullable: true,
    required: false,
  })
  actorEmail?: string | null;

  @ApiProperty({
    description: '대상 사용자 ID',
    nullable: true,
    required: false,
  })
  targetUserId?: string | null;

  @ApiProperty({
    description: '대상 사용자 이름',
    nullable: true,
    required: false,
  })
  targetDisplayName?: string | null;

  @ApiProperty({ description: '대상 이메일', nullable: true, required: false })
  targetEmail?: string | null;

  @ApiProperty({ description: '변경 전 역할', nullable: true, required: false })
  beforeRole?: string | null;

  @ApiProperty({ description: '변경 후 역할', nullable: true, required: false })
  afterRole?: string | null;

  @ApiProperty({ description: '변경 전 상태', nullable: true, required: false })
  beforeStatus?: string | null;

  @ApiProperty({ description: '변경 후 상태', nullable: true, required: false })
  afterStatus?: string | null;

  @ApiProperty({ description: '생성 일시' })
  createdAt: string;
}
