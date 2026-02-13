import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendKakaoTalkRequestDto {
  @ApiProperty({
    description: 'Recipient phone number',
    example: '01012345678',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Message body',
    example: 'Test message',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Optional KakaoTalk template code',
    required: false,
  })
  @IsString()
  @IsOptional()
  templateCode?: string;
}
