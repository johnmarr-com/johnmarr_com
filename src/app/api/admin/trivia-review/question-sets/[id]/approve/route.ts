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
  const pool = getNeonPool();
  const r = await pool.query(
    `UPDATE question_sets
       SET reviewed = true, approved = true, rejection_reason = NULL
     WHERE id = $1 RETURNING id`,
    [id],
  );
  if (r.rowCount === 0) {
    return NextResponse.json({ error: "Question set not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
