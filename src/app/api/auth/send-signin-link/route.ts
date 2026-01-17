import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateSignInLink } from "@/lib/firebase-admin";

const resend = new Resend(process.env["RESEND_API_KEY"]);

// Your Resend template ID for account activation
const TEMPLATE_ID = process.env["RESEND_TEMPLATE_ID"] || "account-activation";

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, funnelId } = await request.json();

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

    // Generate Firebase sign-in link using Admin SDK
    const signInLink = await generateSignInLink(email, redirectUrl);

    // Send email via Resend using template
    const { data, error } = await resend.emails.send({
      from: "John Marr <hello@mail.johnmarr.com>",
      to: email,
      subject: firstName 
        ? `Hi ${firstName} - Activate your FREE Account`
        : "Activate your FREE Account",
      template: {
        id: TEMPLATE_ID,
        variables: {
          firstName: firstName || "there",
          signInLink: signInLink,
        },
      },
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
