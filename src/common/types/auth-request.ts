import type { Request } from 'express';

export type AuthRequest = Request & {
  accessToken?: string;
};