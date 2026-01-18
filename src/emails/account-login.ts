/**
 * Account Login Email Template
 * 
 * Sent when a returning user requests a sign-in link.
 * Uses brand colors from JMStyle theme.
 */

import { johnmarrTheme } from "@/JMStyle/themes";

const theme = johnmarrTheme;

export interface AccountLoginEmailProps {
  firstName: string;
  signInLink: string;
}

export function buildAccountLoginEmail({ firstName, signInLink }: AccountLoginEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: ${theme.surfaces.base}; font-family: ${theme.typography.fontFamily};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${theme.surfaces.base};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="https://johnmarr.com${theme.logo}" alt="${theme.logoAlt}" width="180" style="display: block;">
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="color: ${theme.text.primary}; font-size: 24px; font-weight: 600; padding-bottom: 16px;">
              Welcome back, ${firstName}! 👋
            </td>
          </tr>
          
          <!-- Message -->
          <tr>
            <td style="color: ${theme.text.secondary}; font-size: 16px; line-height: 1.6; padding-bottom: 32px;">
              Click the button below to sign in to your account.
            </td>
          </tr>
          
          <!-- Button -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${signInLink}" target="_blank" style="display: inline-block; padding: 18px 48px; font-size: 16px; font-weight: 700; color: ${theme.text.primary}; text-decoration: none; border-radius: 50px; background: ${theme.gradient.css}; background-color: ${theme.primary};">
                Sign In
              </a>
            </td>
          </tr>
          
          <!-- Subtext -->
          <tr>
            <td style="color: ${theme.text.tertiary}; font-size: 13px; line-height: 1.5; padding-bottom: 32px;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="border-top: 1px solid ${theme.surfaces.elevated2}; padding-top: 24px;">
              <p style="color: ${theme.text.tertiary}; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} John Marr · <a href="https://johnmarr.com" style="color: ${theme.text.tertiary};">johnmarr.com</a>
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
