import { Resend } from "resend";
import { getEnv } from "@/lib/env";
import {
  EmailProviderNotConfiguredError,
  type EmailProvider,
  type SendEmailInput,
} from "./email-provider.interface";

/**
 * Real Resend adapter. No mocking — if RESEND_API_KEY / EMAIL_FROM
 * are absent, every call throws EmailProviderNotConfiguredError
 * instead of pretending to send.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  get isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
  }

  async send(input: SendEmailInput): Promise<{ id: string }> {
    const env = getEnv();
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new EmailProviderNotConfiguredError(this.name);
    }

    const client = new Resend(env.RESEND_API_KEY);
    const result = await client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (result.error) {
      throw new Error(`Resend send failed: ${result.error.message}`);
    }

    return { id: result.data?.id ?? "unknown" };
  }
}
