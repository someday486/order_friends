export type SystemAdminConfig = {
  adminEmails: Set<string>;
  adminUserIds: Set<string>;
  adminEmailDomains: Set<string>;
  adminBypassAll: boolean;
};

export function parseConfigList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function parseConfigBoolean(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function normalizeConfigDomains(values: string[]): Set<string> {
  const domains = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .map((value) => (value.startsWith('@') ? value.slice(1) : value));
  return new Set(domains);
}

export function buildSystemAdminConfig(
  getValue: (key: string) => string | undefined,
): SystemAdminConfig {
  const rawEmails = parseConfigList(getValue('ADMIN_EMAILS'));
  const rawUserIds = parseConfigList(getValue('ADMIN_USER_IDS'));
  const rawDomains = parseConfigList(getValue('ADMIN_EMAIL_DOMAINS'));

  return {
    adminEmails: new Set(rawEmails.map((value) => value.toLowerCase())),
    adminUserIds: new Set(rawUserIds),
    adminEmailDomains: normalizeConfigDomains(rawDomains),
    adminBypassAll: parseConfigBoolean(getValue('ADMIN_BYPASS')),
  };
}

export function isAllowedAdminDomain(
  email: string,
  adminEmailDomains: Set<string>,
): boolean {
  if (adminEmailDomains.size === 0) return false;
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain) return false;
  return adminEmailDomains.has(domain);
}

export function isConfiguredSystemAdmin(
  config: SystemAdminConfig,
  userId: string,
  email?: string,
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();

  return (
    config.adminBypassAll ||
    config.adminUserIds.has(userId) ||
    (normalizedEmail ? config.adminEmails.has(normalizedEmail) : false) ||
    (normalizedEmail
      ? isAllowedAdminDomain(normalizedEmail, config.adminEmailDomains)
      : false)
  );
}
