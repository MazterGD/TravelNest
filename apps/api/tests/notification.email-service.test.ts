/**
 * Email transport unit tests. nodemailer is mocked; nothing is ever sent.
 * Each test loads a fresh module so the cached transporter does not leak.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const sendMail = vi.fn();
const createTransport = vi.fn();

vi.mock("nodemailer", () => ({
  default: { createTransport: (...args: unknown[]) => createTransport(...args) },
}));

type EmailModule = typeof import("../src/modules/notification/email.service");

const load = async (
  overrides: { env?: string; host?: string; user?: string; pass?: string; port?: number } = {},
): Promise<EmailModule> => {
  vi.resetModules();
  const { config } = await import("../src/config/index");
  config.env = overrides.env ?? "development";
  config.email.host = overrides.host ?? "smtp.test.local";
  config.email.user = overrides.user ?? "smtp-user";
  config.email.pass = overrides.pass ?? "smtp-pass";
  config.email.port = overrides.port ?? 587;
  config.email.from = "noreply@travenest.test";
  return import("../src/modules/notification/email.service");
};

describe("email.service", () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "1" });
    createTransport.mockReset();
    createTransport.mockImplementation(() => ({ sendMail }));
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errors.mockRestore();
  });

  it("never opens an SMTP transport under NODE_ENV=test", async () => {
    const email = await load({ env: "test" });

    expect(await email.sendEmail({ to: "a@b.lk", subject: "s", html: "<p>x</p>" })).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("is a no-op when SMTP credentials are missing", async () => {
    const email = await load({ pass: "" });

    expect(email.isEmailConfigured()).toBe(false);
    expect(await email.sendEmail({ to: "a@b.lk", subject: "s", html: "x" })).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("creates one STARTTLS transport and reuses it", async () => {
    const email = await load({ port: 587 });

    expect(email.isEmailConfigured()).toBe(true);
    expect(await email.sendEmail({ to: "a@b.lk", subject: "One", html: "<p>Hi <b>there</b></p>" })).toBe(true);
    expect(await email.sendEmail({ to: "a@b.lk", subject: "Two", html: "x", text: "plain" })).toBe(true);

    expect(createTransport).toHaveBeenCalledOnce();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.test.local",
        port: 587,
        secure: false,
        auth: { user: "smtp-user", pass: "smtp-pass" },
      }),
    );
    expect(sendMail).toHaveBeenNthCalledWith(1, {
      from: "TraveNest <noreply@travenest.test>",
      to: "a@b.lk",
      subject: "One",
      text: "Hi there",
      html: "<p>Hi <b>there</b></p>",
    });
    expect(sendMail.mock.calls[1][0].text).toBe("plain");
  });

  it("uses implicit TLS on port 465", async () => {
    const email = await load({ port: 465 });

    await email.sendEmail({ to: "a@b.lk", subject: "s", html: "x" });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });

  it("returns false and logs a masked address when delivery fails", async () => {
    const email = await load();
    sendMail.mockRejectedValue(new Error("relay down"));

    expect(await email.sendEmail({ to: "kasun@example.lk", subject: "Hi", html: "x" })).toBe(false);
    expect(await email.sendEmail({ to: "k@example.lk", subject: "Hi", html: "x" })).toBe(false);
    expect(await email.sendEmail({ to: "not-an-address", subject: "Hi", html: "x" })).toBe(false);

    const logged = errors.mock.calls.map((call) => String(call[0]));
    expect(logged[0]).toBe('[email] failed to send "Hi" to ka***@example.lk');
    expect(logged[1]).toBe('[email] failed to send "Hi" to k*@example.lk');
    expect(logged[2]).toBe('[email] failed to send "Hi" to ***');
    expect(logged.join(" ")).not.toContain("kasun@");
  });

  it("stops trying after the transport fails to initialise", async () => {
    const email = await load();
    createTransport.mockImplementation(() => {
      throw new Error("bad config");
    });

    expect(await email.sendEmail({ to: "a@b.lk", subject: "s", html: "x" })).toBe(false);
    expect(await email.sendEmail({ to: "a@b.lk", subject: "s", html: "x" })).toBe(false);

    expect(createTransport).toHaveBeenCalledOnce();
    expect(errors).toHaveBeenCalledWith(
      "[email] failed to initialise SMTP transport",
      expect.any(Error),
    );
  });

  it("sends an OTP email with the escaped code and purpose", async () => {
    const email = await load();

    expect(await email.sendOtpEmail("a@b.lk", "12<34", "LOGIN", 10)).toBe(true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("Your TraveNest verification code");
    expect(mail.html).toContain("12&lt;34");
    expect(mail.html).toContain("sign in to your account");
    expect(mail.text).toBe("Your TraveNest verification code is 12<34. It expires in 10 minutes.");

    await email.sendOtpEmail("a@b.lk", "1", "SOMETHING_ELSE", 5);
    expect(sendMail.mock.calls[1][0].html).toContain("Use the code below to continue.");
  });

  it("sends a password reset email with an escaped link", async () => {
    const email = await load();
    const url = "https://travenest.lk/reset?t=a&b=\"c\"'";

    expect(await email.sendPasswordResetEmail("a@b.lk", url, 30)).toBe(true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("Reset your TraveNest password");
    expect(mail.html).toContain("https://travenest.lk/reset?t=a&amp;b=&quot;c&quot;&#39;");
    expect(mail.text).toContain(url);
    expect(mail.text).toContain("30 minutes");
  });

  it("sends a notification email with or without a call to action", async () => {
    const email = await load();

    await email.sendNotificationEmail("a@b.lk", "Booking <ok>", "Paid & done", "https://x.lk/b/1");
    await email.sendNotificationEmail("a@b.lk", "Plain", "No link", undefined);
    await email.sendNotificationEmail("a@b.lk", "Custom", "Go", "https://x.lk", "Open trip");

    const [withCta, withoutCta, custom] = sendMail.mock.calls.map(([mail]) => mail);
    expect(withCta.subject).toBe("TraveNest: Booking <ok>");
    expect(withCta.html).toContain("Booking &lt;ok&gt;");
    expect(withCta.html).toContain("Paid &amp; done");
    expect(withCta.html).toContain('href="https://x.lk/b/1"');
    expect(withCta.html).toContain("View details");
    expect(withCta.text).toBe("Paid & done");
    expect(withoutCta.html).not.toContain("href=");
    expect(custom.html).toContain("Open trip");
  });
});
