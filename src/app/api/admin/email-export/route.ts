import { NextRequest, NextResponse } from "next/server";
import type { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminFirestore } from "@/lib/firebase-admin";

/** Quote a CSV field (RFC 4180). */
function csv(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toIso = (v: unknown): string =>
  v && typeof (v as Timestamp).toDate === "function"
    ? (v as Timestamp).toDate().toISOString()
    : "";

/**
 * Admin-only CSV export of marketing-consented users — the mechanical path
 * from "emails collected in exchange for fun" to an ESP / campaign list.
 * GET /api/admin/email-export  (Authorization: Bearer <admin ID token>)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("status" in auth) return auth;

  const db = getAdminFirestore();
  const snap = await db
    .collection("users")
    .where("marketingConsent.granted", "==", true)
    .get();

  const header = "email,name,gamertag,level,points,consentSource,consentAt,createdAt";
  const rows = snap.docs
    .map((doc) => {
      const d = doc.data();
      const consent = (d["marketingConsent"] ?? {}) as Record<string, unknown>;
      const email = typeof d["email"] === "string" ? d["email"] : "";
      if (!email) return null;
      return [
        csv(email),
        csv(d["name"] ?? d["displayName"] ?? ""),
        csv(d["gamertag"] ?? ""),
        csv(d["level"] ?? ""),
        csv(d["points"] ?? ""),
        csv(consent["source"] ?? ""),
        csv(toIso(consent["at"])),
        csv(toIso(d["createdAt"])),
      ].join(",");
    })
    .filter((row): row is string => row !== null);

  const body = [header, ...rows].join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="consented-emails-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
