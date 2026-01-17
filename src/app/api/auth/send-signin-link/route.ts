import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateSignInLink } from "@/lib/firebase-admin";

const resend = new Resend(process.env["RESEND_API_KEY"]);

function buildEmailHtml(firstName: string, signInLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="https://johnmarr.com/images/logos/JohnMarr-Signature.png" alt="John Marr" width="180" style="display: block;">
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="color: #ffffff; font-size: 24px; font-weight: 600; padding-bottom: 16px;">
              Hey ${firstName}! 👋
            </td>
          </tr>
          
          <!-- Message -->
          <tr>
            <td style="color: #a0a0a0; font-size: 16px; line-height: 1.6; padding-bottom: 32px;">
              You're one click away from unlocking your <span style="color: #e03dff; font-weight: 600;">FREE</span> account. 
              Click the button below to get started.
            </td>
          </tr>
          
          <!-- Button -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${signInLink}" target="_blank" style="display: inline-block; padding: 18px 48px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 50px; background: linear-gradient(135deg, #6310ef 0%, #c529bf 100%); background-color: #6310ef;">
                Activate FREE Account
              </a>
            </td>
          </tr>
          
          <!-- Subtext -->
          <tr>
            <td style="color: #666666; font-size: 13px; line-height: 1.5; padding-bottom: 32px;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="border-top: 1px solid #333333; padding-top: 24px;">
              <p style="color: #666666; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} John Marr · <a href="https://johnmarr.com" style="color: #666666;">johnmarr.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, funnelId } = await request.json();
    console.log("[send-signin-link] Request received:", { email, firstName, funnelId });

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Build the redirect URL with all necessary params
    const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] || "https://johnmarr.com";
    let redirectUrl = `${baseUrl}/auth?email=${encodeURIComponent(email)}`;
    
    if (firstName) {
      redirectUrl += `&name=${encodeURIComponent(firstName)}`;
    }
    if (funnelId) {
      redirectUrl += `&funnel=${encodeURIComponent(funnelId)}`;
    }
    console.log("[send-signin-link] Redirect URL:", redirectUrl);

    // Generate Firebase sign-in link using Admin SDK
    console.log("[send-signin-link] Generating Firebase sign-in link...");
    const signInLink = await generateSignInLink(email, redirectUrl);
    console.log("[send-signin-link] Sign-in link generated:", signInLink ? "success" : "FAILED (null)");

    if (!signInLink) {
      console.error("[send-signin-link] Firebase Admin failed to generate sign-in link");
      return NextResponse.json(
        { error: "Failed to generate sign-in link" },
        { status: 500 }
      );
    }

    // Send email via Resend with HTML
    console.log("[send-signin-link] Sending via Resend...");
    const { data, error } = await resend.emails.send({
      from: "John Marr <hello@mail.johnmarr.com>",
      to: email,
      subject: firstName 
        ? `Hey ${firstName} - Activate your FREE Account`
        : "Activate your FREE Account",
      html: buildEmailHtml(firstName || "there", signInLink),
    });

    if (error) {
      console.error("[send-signin-link] Resend error:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    console.log("[send-signin-link] Email sent successfully:", data);
    return NextResponse.json({ success: true, messageId: data?.id });

  } catch (error) {
    console.error("[send-signin-link] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
