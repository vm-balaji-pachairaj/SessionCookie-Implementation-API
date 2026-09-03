export interface P2Meta {
  displayName: string;
  route: string;
  icon: string;
  order: number;
}

/**
 * Parses a P2 metadata string of the form
 * "displayName:X|route:Y|icon:Z|order:N" into a plain object.
 * Shared by CasbinService (menu resolution) and AdminService (policy listing).
 */
export function parseP2Metadata(meta: string | null): P2Meta {
  const parsed: Record<string, string> = {};

  for (const part of (meta ?? '').split('|')) {
    const separatorIndex = part.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    parsed[key] = value;
  }

  return {
    displayName: parsed.displayName ?? '',
    route: parsed.route ?? '',
    icon: parsed.icon ?? '',
    order: Number(parsed.order ?? 0) || 0,
  };
}
