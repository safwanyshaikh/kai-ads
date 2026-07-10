import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import {
  EmailProviderNotConfiguredError,
  type EmailProvider,
  type SendEmailInput,
} from "./email-provider.interface";

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";

  get isConfigured(): boolean {
    const env = getEnv();
    return Boolean(
      env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM,
    );
  }

  async send(input: SendEmailInput): Promise<{ id: string }> {
    const env = getEnv();
    if (!this.isConfigured) {
      throw new EmailProviderNotConfiguredError(this.name);
    }

    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? false,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });

    const result = await transport.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    return { id: result.messageId };
  }
}
