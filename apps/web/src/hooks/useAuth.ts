'use client';

import { useContext } from 'react';
import { AuthContext } from '@/providers/AuthProvider';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx; // ✅ 여기서 ctx를 그대로 반환해야 refresh도 살아있음
}
