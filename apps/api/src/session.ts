/** Explicit units prevent the ambiguous numeric-string behavior of JWT libraries. */
export function sessionSeconds(value = '8h'): number {
  const match = /^(\d+)(s|m|h)$/.exec(value.trim());
  if (!match) throw new Error('JWT_EXPIRES_IN must use seconds, minutes or hours (e.g. 30m or 8h).');
  const seconds = Number(match[1]) * ({ s: 1, m: 60, h: 3600 }[match[2]]!);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 28800) {
    throw new Error('JWT_EXPIRES_IN must be positive and no longer than 8 hours.');
  }
  return seconds;
}
