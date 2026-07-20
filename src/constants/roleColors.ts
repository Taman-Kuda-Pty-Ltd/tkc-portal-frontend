// Consistent, brand-aligned identity colours for role chips (UAT#3 color pass).
// These are Mantine color names registered in the theme (main.tsx) + built-ins.
// Deliberately avoids red/orange/yellow (reserved for state semantics: danger /
// attention / caution) so a role chip never reads as a warning.
const ROLE_COLORS: Record<string, string> = {
  admin: "tkc", // brand maroon
  manager: "royal", // brand blue
  coach: "gold", // brand gold
  groom: "teal",
  stablehand: "cyan",
  volunteer: "grape",
};

/** A stable colour for a role, by slug. Unknown roles hash to a small brand-safe set. */
export function roleColor(slug: string | undefined | null): string {
  if (slug && ROLE_COLORS[slug]) return ROLE_COLORS[slug];
  const palette = ["royal", "gold", "teal", "cyan", "grape", "indigo"];
  let h = 0;
  for (const ch of slug ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
