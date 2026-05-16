// Tencent CSIG CRM deep-link helper.
//
// The application doesn't have its own CRM — Tencent's internal "csigcrm"
// is the source of truth for account records. We render an "Open in CRM"
// button on every client detail page so anyone (visitor or owner) can
// jump to the canonical record in one click.
//
// The URL is configurable via `NEXT_PUBLIC_CRM_URL` so non-Tencent
// deployments can repoint at a different CRM without redeploying. The
// default value is the canonical Tencent CSIG CRM customisation page
// (the same `belongId` Bryan uses day-to-day).

const DEFAULT_CRM_URL =
  "https://csigcrm.woa.com/index.action#/spa/customize.action?belongId=2078245914263586";

/**
 * Returns the URL to open in a new tab when the user clicks
 * "Open in CRM". Reads `NEXT_PUBLIC_CRM_URL` first; falls back to the
 * canonical Tencent CSIG CRM URL so the button always works in a
 * Tencent context without extra configuration.
 *
 * Marked `NEXT_PUBLIC_*` so the value is inlined into the client
 * bundle and accessible from server and client components alike.
 */
export function getCrmUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_CRM_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  return DEFAULT_CRM_URL;
}
