import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type RequestUser = {
  id: string;
  email?: string;
};

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
