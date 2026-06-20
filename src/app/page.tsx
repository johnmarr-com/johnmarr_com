import HomeClient from "./_home/HomeClient";
import { getHomeContent, type HomeFeatured, type HomeRow } from "@/lib/content-server";

// Render at runtime (where Admin creds exist on Cloud Run), not at build time.
// The content itself is cached for 60s via unstable_cache (see getHomeContent)
// and bustable on demand, so the experiences graph isn't re-read every request.
// Either way the content lands in server-rendered HTML — never a client
// Firestore read (which wedges on iOS).
export const dynamic = "force-dynamic";

export default async function Home() {
  let featured: HomeFeatured[] = [];
  let rows: HomeRow[] = [];
  try {
    ({ featured, rows } = await getHomeContent());
  } catch (error) {
    // Render gracefully (empty) rather than crash the home on a transient error.
    console.error("[home] server content fetch failed:", error);
  }

  return <HomeClient featured={featured} rows={rows} />;
}
