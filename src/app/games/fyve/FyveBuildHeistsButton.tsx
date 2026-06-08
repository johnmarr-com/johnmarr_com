"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { JMProButton } from "@/JMKit";

/**
 * Landing-screen "Build Heists" button — visible only to admins / pro users.
 * Self-contained (its own auth + router) so it can be passed to composeGame as
 * `landingExtra`.
 */
export default function FyveBuildHeistsButton() {
  const router = useRouter();
  const { isAdmin, userTier } = useAuth();
  if (!(isAdmin || userTier === "pro")) return null;
  return (
    <JMProButton
      title="Build Heists"
      onClick={() => router.push("/games/fyve/heists")}
    />
  );
}
