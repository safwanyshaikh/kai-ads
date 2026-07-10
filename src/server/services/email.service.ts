import { getEmailProvider } from "@/server/providers/email";
import { createLogger } from "@/lib/logger";

const log = createLogger("email-service");

export const emailService = {
  get isConfigured(): boolean {
    return getEmailProvider().isConfigured;
  },

  async sendMagicLink(to: string, url: string): Promise<void> {
    const provider = getEmailProvider();
    if (!provider.isConfigured) {
      log.warn(
        { to },
        "Email provider not configured — magic link cannot be delivered. Set EMAIL_PROVIDER and its credentials.",
      );
      throw new Error(
        "Sign-in email could not be sent because email delivery is not configured yet.",
      );
    }

    await provider.send({
      to,
      subject: "Your KAI Ads sign-in link",
      html: `<p>Click the link below to sign in to KAI Ads. This link expires in 15 minutes.</p><p><a href="${url}">${url}</a></p>`,
      text: `Sign in to KAI Ads: ${url}`,
    });
  },

  async sendAgencyApproved(to: string, agencyName: string): Promise<void> {
    const provider = getEmailProvider();
    if (!provider.isConfigured) {
      log.warn({ to }, "Email provider not configured — approval notice not sent.");
      return;
    }
    await provider.send({
      to,
      subject: `${agencyName} is approved on KAI Ads`,
      html: `<p>Good news — <strong>${agencyName}</strong> has been approved. You can now sign in and start using KAI Ads.</p>`,
    });
  },

  async sendAgencyRejected(to: string, agencyName: string, reason: string): Promise<void> {
    const provider = getEmailProvider();
    if (!provider.isConfigured) {
      log.warn({ to }, "Email provider not configured — rejection notice not sent.");
      return;
    }
    await provider.send({
      to,
      subject: `${agencyName} registration was not approved`,
      html: `<p>Your agency registration for <strong>${agencyName}</strong> was not approved.</p><p>Reason: ${reason}</p>`,
    });
  },

  async sendJoinRequestDecision(
    to: string,
    approved: boolean,
    agencyName: string,
  ): Promise<void> {
    const provider = getEmailProvider();
    if (!provider.isConfigured) {
      log.warn({ to }, "Email provider not configured — join request notice not sent.");
      return;
    }
    await provider.send({
      to,
      subject: approved
        ? `You've joined ${agencyName} on KAI Ads`
        : `Your request to join ${agencyName} was declined`,
      html: approved
        ? `<p>Your request to join <strong>${agencyName}</strong> was approved. Sign in to get started.</p>`
        : `<p>Your request to join <strong>${agencyName}</strong> was declined by the agency admin.</p>`,
    });
  },
};
