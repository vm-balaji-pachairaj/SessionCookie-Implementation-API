export interface PMeta {
  displayName: string;
  route: string;
  icon: string;
  order: number;
}

export type P2Meta = PMeta;

/**
 * Parses a P (Menu) metadata string of the form
 * "displayName:X|route:Y|icon:Z|order:N" into a plain object.
 * Shared by CasbinService (menu resolution) and AdminService (policy listing).
 */
export function parsePMetadata(meta: string | null): PMeta {
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

/** Backward compatibility alias */
export const parseP2Metadata = parsePMetadata;
