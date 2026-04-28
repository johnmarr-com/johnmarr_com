import { NextRequest, NextResponse } from "next/server";
import { getNeonPool } from "@/lib/neon";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export interface ReviewQuestionSet {
  id: string;
  verifiedTruthAnchor: string | null;
  truthText: string | null;
  partiallyTrueText: string | null;
  falseText: string | null;
  reviewed: boolean;
  approved: boolean;
  rejectionReason: string | null;
  tags: { category: string; value: string }[];
}

export interface ReviewSubjectDetail {
  id: string;
  firestoreId: string;
  gameId: string;
  listType: string;
  popularityRank: number;
  name: string;
  creator: string | null;
  year: number | null;
  genre: string | null;
  citationUrl: string | null;
  questionSets: ReviewQuestionSet[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!("ok" in auth)) return auth;

  const { id } = await params;
  const pool = getNeonPool();

  const subjectRes = await pool.query(
    `SELECT id, firestore_id, game_id, list_type, popularity_rank, name, creator, year, genre, citation_url
     FROM subjects WHERE id = $1`,
    [id],
  );
  if (subjectRes.rowCount === 0) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }
  const s = subjectRes.rows[0];

  const qsRes = await pool.query(
    `SELECT
       qs.id, qs.verified_truth_anchor, qs.truth_text, qs.partially_true_text,
       qs.false_text, qs.reviewed, qs.approved, qs.rejection_reason,
       COALESCE(
         (SELECT json_agg(json_build_object('category', t.category, 'value', t.value))
          FROM question_set_tags qst
          JOIN tags t ON t.id = qst.tag_id
          WHERE qst.question_set_id = qs.id),
         '[]'::json
       ) AS tags
     FROM question_sets qs
     WHERE qs.subject_id = $1
     ORDER BY qs.created_at`,
    [id],
  );

  const detail: ReviewSubjectDetail = {
    id: s.id,
    firestoreId: s.firestore_id,
    gameId: s.game_id,
    listType: s.list_type,
    popularityRank: s.popularity_rank,
    name: s.name,
    creator: s.creator,
    year: s.year,
    genre: s.genre,
    citationUrl: s.citation_url,
    questionSets: qsRes.rows.map((r) => ({
      id: r.id,
      verifiedTruthAnchor: r.verified_truth_anchor,
      truthText: r.truth_text,
      partiallyTrueText: r.partially_true_text,
      falseText: r.false_text,
      reviewed: r.reviewed,
      approved: r.approved,
      rejectionReason: r.rejection_reason,
      tags: r.tags ?? [],
    })),
  };

  return NextResponse.json(detail);
}
