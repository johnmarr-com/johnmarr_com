/**
 * Email Templates
 * 
 * Centralized email templates using JMStyle brand colors.
 * All templates are HTML strings ready to send via Resend.
 * 
 * Usage:
 * ```ts
 * import { buildAccountActivationEmail } from "@/emails";
 * 
 * const html = buildAccountActivationEmail({ firstName: "John", signInLink: "https://..." });
 * await resend.emails.send({ html, ... });
 * ```
 */

export { buildAccountActivationEmail, type AccountActivationEmailProps } from "./account-activation";
