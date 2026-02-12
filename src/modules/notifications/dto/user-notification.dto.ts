import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserNotificationResponse {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({
    description: 'Notification type (LOW_STOCK, ORDER_UPDATE, INFO, etc.)',
  })
  type: string;

  @ApiProperty({ description: 'Notification title' })
  title: string;

  @ApiPropertyOptional({ description: 'Notification message body' })
  message?: string;

  @ApiPropertyOptional({ description: 'Link to navigate to' })
  link?: string;

  @ApiProperty({ description: 'Whether the notification has been read' })
  is_read: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Created at' })
  created_at: string;

  @ApiPropertyOptional({ description: 'Read at' })
  read_at?: string;
}
