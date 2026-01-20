import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class MeController {
  @Get('/me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return { user };
  }
}
