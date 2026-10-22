import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../../config/index.js";

/**
 * Transactional email transport (Brevo SMTP relay via nodemailer).
 *
 * Every public sender returns a boolean and never throws — email is a
 * best-effort side channel, so a delivery failure must not break the auth or
 * notification flow that triggered it. When SMTP is not configured the whole
 * module degrades to a no-op so local development keeps working without creds.
 */

let transporter: Transporter | null = null;
let transportInitFailed = false;

export const isEmailConfigured = (): boolean =>
  Boolean(config.email.host && config.email.user && config.email.pass);

const getTransporter = (): Transporter | null => {
  // Never reach for a real SMTP socket during automated tests.
  if (config.env === "test") return null;
  if (!isEmailConfigured() || transportInitFailed) return null;
  if (transporter) return transporter;

  try {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465, // 465 = implicit TLS; 587/2525 use STARTTLS
      auth: { user: config.email.user, pass: config.email.pass },
      // Bound the request so a slow/unreachable relay never hangs the caller.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  } catch (err) {
    transportInitFailed = true;
    console.error("[email] failed to initialise SMTP transport", err);
    return null;
  }

  return transporter;
};

const maskEmail = (email: string): string => {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "***";
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  const transport = getTransporter();
  if (!transport) return false;

  try {
    await transport.sendMail({
      from: `TraveNest <${config.email.from}>`,
      to: options.to,
      subject: options.subject,
      text: options.text ?? stripHtml(options.html),
      html: options.html,
    });
    return true;
  } catch (err) {
    console.error(
      `[email] failed to send "${options.subject}" to ${maskEmail(options.to)}`,
      err,
    );
    return false;
  }
};

// ----------------------------------------------------------------------------
// Brand-faithful HTML shell (design tokens mirrored from the design system).
// ----------------------------------------------------------------------------

const BRAND = {
  primary: "#20B0E9",
  text: "#0F172A",
  textSecondary: "#475569",
  surface: "#F8FAFC",
  border: "#E2E8F0",
} as const;

const layout = (heading: string, bodyHtml: string): string => `
  <div style="background:${BRAND.surface};padding:32px 0;font-family:Inter,Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;">
      <div style="background:${BRAND.primary};padding:24px 32px;">
        <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.01em;">TraveNest</span>
      </div>
      <div style="padding:32px;color:${BRAND.text};">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${BRAND.text};">${heading}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:16px 32px;border-top:1px solid ${BRAND.border};color:${BRAND.textSecondary};font-size:12px;line-height:1.6;">
        You're receiving this because you have a TraveNest account. Need a hand? Just reply to this email.
      </div>
    </div>
  </div>
`;

const paragraph = (html: string): string =>
  `<p style="margin:0 0 16px;color:${BRAND.textSecondary};font-size:14px;line-height:1.6;">${html}</p>`;

const button = (label: string, url: string): string =>
  `<a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;">${escapeHtml(label)}</a>`;

// ----------------------------------------------------------------------------
// Senders
// ----------------------------------------------------------------------------

const OTP_PURPOSE_LABEL: Record<string, string> = {
  LOGIN: "sign in to your account",
  REGISTRATION: "verify your new account",
  PHONE_VERIFICATION: "verify your contact details",
};

export const sendOtpEmail = async (
  to: string,
  code: string,
  purpose: string,
  expiryMinutes: number,
): Promise<boolean> => {
  const reason = OTP_PURPOSE_LABEL[purpose] ?? "continue";
  const body = `
    ${paragraph(`Use the code below to ${reason}. It expires in ${expiryMinutes} minutes.`)}
    <div style="text-align:center;margin:0 0 16px;">
      <span style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:700;color:${BRAND.text};background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 24px;">${escapeHtml(code)}</span>
    </div>
    ${paragraph("Didn't request this? You can safely ignore this email — your account is still secure.")}
  `;

  return sendEmail({
    to,
    subject: "Your TraveNest verification code",
    html: layout("Here's your verification code", body),
    text: `Your TraveNest verification code is ${code}. It expires in ${expiryMinutes} minutes.`,
  });
};

export const sendPasswordResetEmail = async (
  to: string,
  resetUrl: string,
  expiryMinutes: number,
): Promise<boolean> => {
  const body = `
    ${paragraph(`We received a request to reset your TraveNest password. Choose a new one using the button below — this link expires in ${expiryMinutes} minutes.`)}
    <div style="margin:0 0 16px;">${button("Reset my password", resetUrl)}</div>
    ${paragraph("If the button doesn't work, paste this link into your browser:")}
    <p style="margin:0 0 16px;word-break:break-all;font-size:12px;color:${BRAND.primary};">${escapeHtml(resetUrl)}</p>
    ${paragraph("Didn't request a reset? Ignore this email and your password stays unchanged.")}
  `;

  return sendEmail({
    to,
    subject: "Reset your TraveNest password",
    html: layout("Reset your password", body),
    text: `Reset your TraveNest password: ${resetUrl} (expires in ${expiryMinutes} minutes). If you didn't request this, ignore this email.`,
  });
};

export const sendNotificationEmail = async (
  to: string,
  title: string,
  message: string,
  ctaUrl?: string,
  ctaLabel = "View details",
): Promise<boolean> => {
  const body = `
    ${paragraph(escapeHtml(message))}
    ${ctaUrl ? `<div style="margin-top:8px;">${button(ctaLabel, ctaUrl)}</div>` : ""}
  `;

  return sendEmail({
    to,
    subject: `TraveNest: ${title}`,
    html: layout(escapeHtml(title), body),
    text: message,
  });
};
