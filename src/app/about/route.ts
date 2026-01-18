import { NextResponse } from "next/server";

/**
 * About Page - Redirects to appropriate Carrd site based on device width
 * 
 * - Desktop/Tablet (>=737px): about.johnmarr.com
 * - Mobile (<737px): mobile.johnmarr.com
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>John Marr</title>
  <style>
    body {
      background: #000;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .loader {
      width: 24px;
      height: 24px;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loader"></div>
  <script>
    (function() {
      var width = window.innerWidth || document.documentElement.clientWidth;
      var isMobile = width < 737;
      
      if (isMobile) {
        window.location.replace('https://mobile.johnmarr.com');
      } else {
        window.location.replace('https://about.johnmarr.com');
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
