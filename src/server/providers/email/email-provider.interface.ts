export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  /** Human-readable provider name, used in logs. */
  readonly name: string;
  /** True only when all required credentials are present. */
  readonly isConfigured: boolean;
  send(input: SendEmailInput): Promise<{ id: string }>;
}

/**
 * Thrown when an EmailProvider method is called but required
 * credentials are missing. This is intentionally NOT a mock —
 * calling code must handle this error, it never silently succeeds.
 */
export class EmailProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `Email provider "${provider}" is not configured. Set the required environment variables before sending email.`,
    );
    this.name = "EmailProviderNotConfiguredError";
  }
}
