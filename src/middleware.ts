import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware to ensure static assets in /public are served directly
 * without going through Next.js page routing (which triggers AuthGate redirects).
 * 
 * The matcher config below tells Next.js to SKIP middleware for these paths,
 * meaning they get served as static files before any app logic runs.
 */
export function middleware(_request: NextRequest) {
  // For any request that makes it here, just continue normally
  return NextResponse.next();
}

// This is the key part: exclude static assets from Next.js routing
export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (Next.js static files)
     * - _next/image (Next.js image optimization)
     * - favicon.ico (favicon)
     * - images/ (public/images folder)
     * - avatars/ (public/avatars folder)  
     * - lottie/ (public/lottie folder)
     * - *.svg, *.png, *.jpg, *.jpeg, *.gif, *.webp, *.ico (image files)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|avatars/|lottie/|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.ico$).*)",
  ],
};
