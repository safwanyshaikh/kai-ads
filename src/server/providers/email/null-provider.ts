import type { EmailProvider, SendEmailInput } from "./email-provider.interface";

/**
 * Used when EMAIL_PROVIDER=none is explicitly chosen. Distinct from an
 * unconfigured Resend/SMTP provider so error messages are precise about
 * *why* email can't be sent — "no provider was selected" vs "a provider
 * was selected but its credentials are missing".
 */
export class NullEmailProvider implements EmailProvider {
  readonly name = "none";
  readonly isConfigured = false;

  async send(_input: SendEmailInput): Promise<{ id: string }> {
    throw new Error(
      'Email delivery is disabled (EMAIL_PROVIDER=none). Set EMAIL_PROVIDER to "resend" or "smtp" with its credentials to enable it.',
    );
  }
}
