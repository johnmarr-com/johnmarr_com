import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateSignInLink } from "@/lib/firebase-admin";
import { buildAccountActivationEmail, buildAccountLoginEmail } from "@/emails";

const resend = new Resend(process.env["RESEND_API_KEY"]);

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, funnelId, isLogin } = await request.json();
    console.log("[send-signin-link] Request received:", { email, firstName, funnelId, isLogin });

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
    let signInLink: string;
    try {
      signInLink = await generateSignInLink(email, redirectUrl);
      console.log("[send-signin-link] Sign-in link generated successfully");
    } catch (linkError) {
      console.error("[send-signin-link] Firebase Admin generateSignInLink failed:", linkError);
      const errorMsg = linkError instanceof Error ? linkError.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to generate sign-in link: ${errorMsg}` },
        { status: 500 }
      );
    }

    // Choose email template and subject based on login vs signup
    const displayName = firstName || "there";
    const subject = isLogin
      ? `Welcome back${firstName ? `, ${firstName}` : ""} - Sign in to your account`
      : firstName 
        ? `Hey ${firstName} - Activate your FREE Account`
        : "Activate your FREE Account";
    const html = isLogin
      ? buildAccountLoginEmail({ firstName: displayName, signInLink })
      : buildAccountActivationEmail({ firstName: displayName, signInLink });

    // Send email via Resend with HTML
    console.log("[send-signin-link] Sending via Resend...");
    const { data, error } = await resend.emails.send({
      from: "John Marr <hello@mail.johnmarr.com>",
      to: email,
      subject,
      html,
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
    // Return more specific error info in development, generic in production
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
