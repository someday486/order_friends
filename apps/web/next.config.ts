import type { NextConfig } from 'next';

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'http',
    hostname: 'localhost',
    port: '4000',
    pathname: '/**',
  },
];

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    remotePatterns.push({
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port || undefined,
      pathname: '/**',
    });
  } catch {
    // ignore invalid URL
  }
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1'],
  env: {
    NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY:
      process.env.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY ??
      process.env.TOSS_CLIENT_KEY ??
      '',
    NEXT_PUBLIC_TOSS_WIDGET_PAYMENT_METHOD_VARIANT_KEY:
      process.env.NEXT_PUBLIC_TOSS_WIDGET_PAYMENT_METHOD_VARIANT_KEY ??
      process.env.TOSS_WIDGET_PAYMENT_METHOD_VARIANT_KEY ??
      '',
    NEXT_PUBLIC_TOSS_WIDGET_AGREEMENT_VARIANT_KEY:
      process.env.NEXT_PUBLIC_TOSS_WIDGET_AGREEMENT_VARIANT_KEY ??
      process.env.TOSS_WIDGET_AGREEMENT_VARIANT_KEY ??
      '',
  },
  images: {
    remotePatterns,
    qualities: [75, 100],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
