import { NextRequest, NextResponse } from "next/server";
import { getNeonPool } from "@/lib/neon";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!("ok" in auth)) return auth;

  const { id } = await params;
  let body: { reason?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "rejected_by_reviewer";

  const pool = getNeonPool();
  const r = await pool.query(
    `UPDATE question_sets
       SET reviewed = true, approved = false, rejection_reason = $1
     WHERE id = $2 RETURNING id`,
    [reason, id],
  );
  if (r.rowCount === 0) {
    return NextResponse.json({ error: "Question set not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
