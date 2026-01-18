/**
 * Email Templates
 * 
 * Centralized email templates using JMStyle brand colors.
 * All templates are HTML strings ready to send via Resend.
 * 
 * Usage:
 * ```ts
 * import { buildAccountActivationEmail, buildAccountLoginEmail } from "@/emails";
 * 
 * // For new signups
 * const html = buildAccountActivationEmail({ firstName: "John", signInLink: "https://..." });
 * 
 * // For returning users
 * const html = buildAccountLoginEmail({ firstName: "John", signInLink: "https://..." });
 * 
 * await resend.emails.send({ html, ... });
 * ```
 */

export { buildAccountActivationEmail, type AccountActivationEmailProps } from "./account-activation";
export { buildAccountLoginEmail, type AccountLoginEmailProps } from "./account-login";
