import { NextRequest, NextResponse } from "next/server";
import { getNeonPool } from "@/lib/neon";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

type TextField =
  | "truth_text"
  | "partially_true_text"
  | "false_text";

const FIELD_MAP: Record<string, TextField> = {
  truthText: "truth_text",
  partiallyTrueText: "partially_true_text",
  falseText: "false_text",
};

/**
 * PATCH /api/admin/trivia-review/question-sets/:id
 * Body: any of truthText/partiallyTrueText/partiallyTrueAlteration/falseText/falseAlteration.
 * Updates fields, marks reviewed=true (because the reviewer touched it).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!("ok" in auth)) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [k, dbCol] of Object.entries(FIELD_MAP)) {
    if (typeof body[k] === "string") {
      values.push((body[k] as string).trim());
      sets.push(`${dbCol} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  values.push(id);
  const sql = `UPDATE question_sets SET ${sets.join(", ")}, reviewed = true WHERE id = $${values.length} RETURNING id`;

  const pool = getNeonPool();
  const r = await pool.query(sql, values);
  if (r.rowCount === 0) {
    return NextResponse.json({ error: "Question set not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
