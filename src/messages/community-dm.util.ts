/** პირდაპირი DM (კომუნითის პროფილი) — იგივე ფორმატი რაც აპის utils/communityDm.ts */
export function parseCommunityDmRequestId(
  requestId: string,
): { a: string; b: string } | null {
  if (
    !requestId ||
    typeof requestId !== 'string' ||
    !requestId.startsWith('cdm_')
  ) {
    return null;
  }
  const rest = requestId.slice(4);
  const sep = '__';
  const i = rest.indexOf(sep);
  if (i < 0) return null;
  try {
    const a = decodeURIComponent(rest.slice(0, i));
    const b = decodeURIComponent(rest.slice(i + sep.length));
    if (!a || !b) return null;
    return { a, b };
  } catch {
    return null;
  }
}

export function sortedCommunityDmPair(a: string, b: string): [string, string] {
  return [String(a).trim(), String(b).trim()].sort((x, y) =>
    x.localeCompare(y, undefined, { sensitivity: 'base' }),
  ) as [string, string];
}

export function isCommunityDmRequestId(requestId: string): boolean {
  return !!requestId && requestId.startsWith('cdm_');
}
