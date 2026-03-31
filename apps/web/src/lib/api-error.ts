export function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const message = error.message.trim();
  const jsonStart = message.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const payload = JSON.parse(message.slice(jsonStart)) as {
        message?: string | string[];
      };
      if (Array.isArray(payload.message)) {
        const joined = payload.message.filter(Boolean).join(', ').trim();
        if (joined) {
          return joined;
        }
      }

      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
      }
    } catch {
      // Fall back to the raw message below.
    }
  }

  return message || fallback;
}
