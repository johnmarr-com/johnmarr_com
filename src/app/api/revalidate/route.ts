import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { HOME_CONTENT_TAG } from "@/lib/content-server";

/**
 * On-demand revalidation of server-rendered content (admin-only).
 *
 * The home content is cached (60s) under the `home-content` tag. The CMS
 * publish flow POSTs here to bust it immediately so edits go live without
 * waiting for the time-based window.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth; // 401/403

  revalidateTag(HOME_CONTENT_TAG);
  return NextResponse.json({ ok: true, revalidated: HOME_CONTENT_TAG });
}
