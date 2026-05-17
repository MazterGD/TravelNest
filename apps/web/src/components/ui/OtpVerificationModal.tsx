"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Input } from "@/components/ui";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "@/constants";

interface OtpVerificationModalProps {
  isOpen: boolean;
  destination: string;
  isVerifying?: boolean;
  isSending?: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  title?: string;
  subtitle?: string;
}

export function OtpVerificationModal({
  isOpen,
  destination,
  isVerifying = false,
  isSending = false,
  onClose,
  onVerify,
  onResend,
  title = "Verify Your Account",
  subtitle,
}: OtpVerificationModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!isOpen) {
      setCode("");
      setError(null);
      setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      return;
    }

    const intervalId = setInterval(() => {
      setCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isOpen]);

  const helperText = useMemo(() => {
    return (
      subtitle ||
      `Enter the ${OTP_LENGTH}-digit code sent to ${destination}.`
    );
  }, [destination, subtitle]);

  const handleVerify = async () => {
    if (code.trim().length !== OTP_LENGTH) {
      setError(`Please enter a valid ${OTP_LENGTH}-digit code.`);
      return;
    }

    setError(null);
    try {
      await onVerify(code.trim());
    } catch (verifyError) {
      const message =
        verifyError instanceof Error
          ? verifyError.message
          : "Invalid or expired code. Please try again.";
      setError(message);
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      await onResend();
      setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    } catch (resendError) {
      const message =
        resendError instanceof Error
          ? resendError.message
          : "Failed to resend code. Please try again.";
      setError(message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{helperText}</p>

        <Input
          label="OTP Code"
          type="text"
          inputMode="numeric"
          maxLength={OTP_LENGTH}
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
          }
          placeholder={"0".repeat(OTP_LENGTH)}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={handleResend} disabled={cooldown > 0 || isSending}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </Button>
          <Button onClick={handleVerify} isLoading={isVerifying}>
            Verify
          </Button>
        </div>
      </div>
    </Modal>
  );
}