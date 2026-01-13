import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const EXPORT_HASH = "e7786fc880d7acdfee8b";
const ENDPOINT = "https://www.landingiexport.com";
const MONTH_SECONDS = 2592000;

interface LandingiResponse {
  content: string;
  tid: string;
  redirect?: string;
}

/**
 * Landingi Export Route Handler
 * Proxies landing page content from Landingi's export API
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const tidCookie = cookieStore.get("tid")?.value;
  const hash = request.nextUrl.searchParams.get("hash");

  // Build the API URL
  const apiUrl = new URL(`${ENDPOINT}/api/render`);
  apiUrl.searchParams.set("export_hash", EXPORT_HASH);
  if (hash) {
    apiUrl.searchParams.set("conversion_hash", hash);
  }

  // Get host and path for tracking headers
  const host = request.headers.get("host") ?? "johnmarr.com";
  const path = request.nextUrl.pathname || "/about";

  // Prepare headers - these are REQUIRED by Landingi
  const headers: HeadersInit = {
    "User-Agent": "Landingi Export-PHP Curl/8.0 PHP/8.0",
    "X-export-source": "embed",
    "X-export-host": host,
    "X-export-path": path,
  };

  if (tidCookie) {
    headers["Cookie"] = `stg-tracker=tid=${tidCookie}`;
  }

  try {
    const response = await fetch(apiUrl.toString(), {
      headers,
      redirect: "manual",
    });

    // Handle redirects
    if (response.status === 301 || response.status === 302) {
      const data = (await response.json()) as { redirect?: string };
      if (data.redirect) {
        const redirectUrl = processRedirectUrl(data.redirect, request);
        return NextResponse.redirect(redirectUrl);
      }
    }

    if (response.status === 404 || (response.status >= 200 && response.status < 300)) {
      const data = (await response.json()) as LandingiResponse;

      // Process the content
      let content = data.content;
      const actualUrl = getActualUrl(request);

      // Modify form actions
      content = content.replace(
        / action="\/([\s\S]*?)"/g,
        ` action="${ENDPOINT}/$1?export_hash=${EXPORT_HASH}&tid=${data.tid}"`
      );

      // Modify redirect input
      content = content.replace(
        /(<input type="hidden" name="_redirect" value)="">/g,
        `$1="${actualUrl}">`
      );

      // Modify button submission endpoints
      content = content.replace(
        / href="(?:\/[^\/]+)?(\/button\/[a-zA-z0-9]{32})"/g,
        ` href="${ENDPOINT}$1?export_hash=${EXPORT_HASH}&tid=${data.tid}"`
      );

      // Inject custom styles and lightbox handler
      const injectedHead = `
<style>
  html, body {
    background-color: #000000 !important;
  }
  /* Subtle scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }
  /* Firefox */
  html {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  }
</style>
<script>
    if (typeof Lightbox !== 'undefined') {
        Lightbox.init({
            exportUrl: '${ENDPOINT}',
            hash: '${EXPORT_HASH}',
            tid: '${data.tid}',
            redirectUrl: '${actualUrl}'
        });
        Lightbox.register();
    }
</script>`;
      content = content.replace(/<\/head>/, `${injectedHead}</head>`);

      // Create response with HTML content
      const htmlResponse = new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });

      // Set the tid cookie
      htmlResponse.cookies.set("tid", data.tid, {
        maxAge: MONTH_SECONDS,
        path: "/",
      });

      return htmlResponse;
    }

    return new NextResponse("Error loading page", { status: 500 });
  } catch (error) {
    console.error("Landingi fetch error:", error);
    return new NextResponse("Error loading page", { status: 500 });
  }
}

function getActualUrl(request: NextRequest): string {
  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;
  return `${protocol}://${host}${path}`;
}

function processRedirectUrl(redirectUrl: string, request: NextRequest): string {
  try {
    const url = new URL(redirectUrl);
    
    // Merge with current request params, excluding tid and export_hash
    const currentParams = request.nextUrl.searchParams;
    currentParams.forEach((value, key) => {
      if (key !== "tid" && key !== "export_hash") {
        url.searchParams.set(key, value);
      }
    });

    // Remove tid and export_hash from redirect
    url.searchParams.delete("tid");
    url.searchParams.delete("export_hash");

    return url.toString();
  } catch {
    return redirectUrl;
  }
}

