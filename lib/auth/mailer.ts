import 'server-only';

import { Resend } from 'resend';

export type MagicLinkMessage = {
  to: string;
  url: string;
};

export interface AuthMailer {
  sendMagicLink(message: MagicLinkMessage): Promise<void>;
}

export type CapturedMagicLink = MagicLinkMessage & {
  sentAt: Date;
};

export class CaptureAuthMailer implements AuthMailer {
  readonly messages: CapturedMagicLink[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async sendMagicLink(message: MagicLinkMessage): Promise<void> {
    this.messages.push({ ...message, sentAt: this.now() });
  }
}

export function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === '&') return `&${'amp'};`;
    if (character === '<') return `&${'lt'};`;
    if (character === '>') return `&${'gt'};`;
    if (character === '"') return `&${'quot'};`;
    return `&${'#39'};`;
  });
}

export class ResendAuthMailer implements AuthMailer {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async sendMagicLink({ to, url }: MagicLinkMessage): Promise<void> {
    const safeUrl = escapeHtmlAttribute(url);
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Sign in to TikPlay',
      text: `Sign in to TikPlay using this link (expires in 15 minutes): ${url}`,
      html: `<p>Sign in to TikPlay using the link below. It expires in 15 minutes.</p><p><a href="${safeUrl}">Sign in to TikPlay</a></p>`,
    });

    if (error) {
      // Do not include provider details because they may contain recipient data.
      throw new Error('The authentication email could not be sent.');
    }
  }
}

export function createAuthMailer(config?: {
  apiKey: string;
  from: string;
}): AuthMailer {
  if (!config) {
    throw new Error(
      'Magic-link authentication requires RESEND_API_KEY and AUTH_EMAIL_FROM.',
    );
  }
  return new ResendAuthMailer(config.apiKey, config.from);
}
