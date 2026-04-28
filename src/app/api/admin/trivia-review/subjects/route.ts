import { NextRequest, NextResponse } from "next/server";
import { getNeonPool } from "@/lib/neon";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export interface ReviewSubjectListItem {
  id: string;
  firestoreId: string;
  gameId: string;
  listType: string;
  popularityRank: number;
  name: string;
  creator: string | null;
  year: number | null;
  questionSetCount: number;
  approvedCount: number;
  reviewedCount: number;
  pendingCount: number;
  flaggedCount: number;
  falsePendingCount: number;
}

/**
 * GET /api/admin/trivia-review/subjects?gameId=&listType=
 * Lists subjects with research_status='ready' for the given (gameId, listType),
 * along with review/approval counts.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!("ok" in auth)) return auth;

  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const listType = searchParams.get("listType");

  const pool = getNeonPool();
  const params: (string | number)[] = [];
  const where: string[] = ["s.research_status = 'ready'"];
  if (gameId) {
    params.push(gameId);
    where.push(`s.game_id = $${params.length}`);
  }
  if (listType) {
    params.push(listType);
    where.push(`s.list_type = $${params.length}`);
  }

  const sql = `
    SELECT
      s.id, s.firestore_id, s.game_id, s.list_type, s.popularity_rank,
      s.name, s.creator, s.year,
      COUNT(qs.id)::int AS question_set_count,
      COUNT(qs.id) FILTER (WHERE qs.approved = true)::int AS approved_count,
      COUNT(qs.id) FILTER (WHERE qs.reviewed = true)::int AS reviewed_count,
      COUNT(qs.id) FILTER (WHERE qs.reviewed = false)::int AS pending_count,
      COUNT(qs.id) FILTER (WHERE qs.rejection_reason IS NOT NULL)::int AS flagged_count,
      COUNT(qs.id) FILTER (WHERE qs.false_text = 'pending')::int AS false_pending_count
    FROM subjects s
    LEFT JOIN question_sets qs ON qs.subject_id = s.id
    WHERE ${where.join(" AND ")}
    GROUP BY s.id
    ORDER BY s.game_id, s.list_type, s.popularity_rank
  `;
  const r = await pool.query(sql, params);

  const items: ReviewSubjectListItem[] = r.rows.map((row) => ({
    id: row.id,
    firestoreId: row.firestore_id,
    gameId: row.game_id,
    listType: row.list_type,
    popularityRank: row.popularity_rank,
    name: row.name,
    creator: row.creator,
    year: row.year,
    questionSetCount: row.question_set_count,
    approvedCount: row.approved_count,
    reviewedCount: row.reviewed_count,
    pendingCount: row.pending_count,
    flaggedCount: row.flagged_count,
    falsePendingCount: row.false_pending_count,
  }));

  return NextResponse.json({ subjects: items });
}
