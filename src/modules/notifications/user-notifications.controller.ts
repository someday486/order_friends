import {
  Controller,
  Get,
  Body,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../../common/types/auth-request';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import { UserNotificationsService } from './user-notifications.service';
import { NotificationsService } from './notifications.service';
import { UserNotificationResponse } from './dto/user-notification.dto';
import { SendKakaoTalkRequestDto } from './dto/send-kakao-talk.dto';

@ApiTags('customer-notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/notifications')
export class UserNotificationsController {
  private readonly logger = new Logger(UserNotificationsController.name);

  constructor(
    private readonly userNotificationsService: UserNotificationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '알림 목록 조회',
    description: '내 알림 목록을 조회합니다.',
  })
  @ApiQuery({
    name: 'limit',
    description: '조회 개수 (기본 50)',
    required: false,
  })
  @ApiQuery({
    name: 'offset',
    description: '시작 위치 (기본 0)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '알림 목록 조회 성공',
    type: [UserNotificationResponse],
  })
  async getNotifications(
    @Req() req: AuthRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} fetching notifications`);
    return this.userNotificationsService.getNotifications(
      req.user.id,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Patch('read-all')
  @ApiOperation({
    summary: '모든 알림 읽음 처리',
    description: '모든 읽지 않은 알림을 읽음 상태로 변경합니다.',
  })
  @ApiResponse({ status: 200, description: '전체 읽음 처리 성공' })
  async markAllAsRead(@Req() req: AuthRequest) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} marking all notifications as read`);
    return this.userNotificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':notificationId/read')
  @ApiOperation({
    summary: '알림 읽음 처리',
    description: '특정 알림을 읽음 상태로 변경합니다.',
  })
  @ApiParam({ name: 'notificationId', description: '알림 ID' })
  @ApiResponse({ status: 200, description: '알림 읽음 처리 성공' })
  @ApiResponse({ status: 404, description: '알림을 찾을 수 없음' })
  async markAsRead(
    @Req() req: AuthRequest,
    @Param('notificationId') notificationId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(
      `User ${req.user.id} marking notification ${notificationId} as read`,
    );
    await this.userNotificationsService.markAsRead(req.user.id, notificationId);
    return { success: true };
  }

  @Post('send-kakao')
  @ApiBody({ type: SendKakaoTalkRequestDto })
  @ApiOperation({
    summary: 'Send KakaoTalk test notification',
    description:
      'Send a test KakaoTalk notification to the requested phone number.',
  })
  @ApiResponse({
    status: 200,
    description: 'KakaoTalk notification result',
  })
  async sendKakaoNotification(
    @Req() req: AuthRequest,
    @Body() dto: SendKakaoTalkRequestDto,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} sending KakaoTalk test notification`);
    const result = await this.notificationsService.sendKakaoTalk(
      dto.phone,
      dto.message,
      dto.templateCode,
    );

    return { success: result.success, result };
  }
}
