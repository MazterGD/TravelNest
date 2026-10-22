import { createRegistrationProof } from "../src/modules/auth/auth.service";

/**
 * Add the email-verification proof that registration requires (ADR-007),
 * as the web app does after the customer enters the emailed OTP.
 */
export const withRegistrationProof = <T>(payload: T): T => {
  const email = (payload as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string") return payload;
  return { ...payload, registrationToken: createRegistrationProof(email) };
};
