import { redirect } from "next/navigation";

/**
 * The Import section is deprecated. Kept only so old bookmarks don't 404 —
 * it redirects to the home page. The CLI importer (`pnpm import:docx`)
 * still exists for one-off seeding.
 */
export default function DeprecatedImportPage() {
  redirect("/");
}
