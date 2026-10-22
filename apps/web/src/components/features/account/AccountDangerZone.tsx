"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, FileX, Trash2 } from "lucide-react";
import { Button, Modal, TextArea } from "@/components/ui";
import { useAuthStore } from "@/store";
import { api, userService, ApiError } from "@/lib/api";
import { clearAuthRaw } from "@/lib/auth-storage";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

const dangerButton = `inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-[var(--color-error-border)] px-3 text-sm font-medium text-[var(--color-error-text)] transition-colors hover:bg-[var(--color-error-bg)] ${focusRing}`;

const errorBox =
  "rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]";

interface AccountDangerZoneProps {
  locale: string;
}

/**
 * Account removal (a soft delete, refused while anything is pending) and the
 * request for complete data erasure by support (ADR-006). Shared by the
 * customer profile and owner settings.
 */
export function AccountDangerZone({ locale }: AccountDangerZoneProps) {
  const t = useTranslations("profile");
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const [isDataDeletionOpen, setIsDataDeletionOpen] = useState(false);
  const [dataDeletionReason, setDataDeletionReason] = useState("");
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [dataDeletionError, setDataDeletionError] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const closeRemove = () => {
    if (isRemoving) return;
    setIsRemoveOpen(false);
    setRemoveError(null);
  };

  const handleRemoveAccount = async () => {
    setIsRemoving(true);
    setRemoveError(null);
    try {
      await userService.deleteAccount();
      api.stopTokenRefresh();
      logout();
      clearAuthRaw();
      router.push(`/${locale}`);
    } catch (err) {
      setRemoveError(
        err instanceof ApiError ? err.message : t("deleteAccountFailed"),
      );
      setIsRemoving(false);
    }
  };

  const closeDataDeletion = () => {
    if (isRequestingDeletion) return;
    setIsDataDeletionOpen(false);
    setDataDeletionReason("");
    setDataDeletionError(null);
  };

  const handleRequestDataDeletion = async () => {
    setIsRequestingDeletion(true);
    setDataDeletionError(null);
    try {
      const reason = dataDeletionReason.trim();
      const result = await userService.requestDataDeletion(reason || undefined);
      setIsDataDeletionOpen(false);
      setDataDeletionReason("");
      setSuccessMessage(
        t("dataDeletionRequested", { reference: result.reference }),
      );
    } catch (err) {
      setDataDeletionError(
        err instanceof ApiError ? err.message : t("dataDeletionFailed"),
      );
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  return (
    <>
      <section
        className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-bg-base)]"
        aria-labelledby="danger-heading"
      >
        <div className="border-b border-[var(--color-error-border)] px-6 py-4">
          <h2
            id="danger-heading"
            className="text-sm font-semibold text-[var(--color-error-text)]"
          >
            {t("dangerZone")}
          </h2>
        </div>
        {successMessage && (
          <div
            role="status"
            className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-3 text-sm text-[var(--color-success-text)]"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {successMessage}
          </div>
        )}
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("deleteAccount")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {t("deleteAccountDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsRemoveOpen(true)}
            className={dangerButton}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t("delete")}
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--color-error-border)] px-6 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("dataDeletionTitle")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {t("dataDeletionDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDataDeletionOpen(true)}
            className={dangerButton}
          >
            <FileX className="h-4 w-4" aria-hidden="true" />
            {t("dataDeletionAction")}
          </button>
        </div>
      </section>

      <Modal
        isOpen={isRemoveOpen}
        onClose={closeRemove}
        title={t("deleteAccountConfirmTitle")}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("deleteAccountConfirmMessage")}
          </p>
          {removeError && (
            <div role="alert" className={errorBox}>
              {removeError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeRemove} disabled={isRemoving}>
              {t("cancel")}
            </Button>
            <button
              type="button"
              disabled={isRemoving}
              onClick={() => void handleRemoveAccount()}
              className={`${dangerButton} disabled:opacity-50`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("deleteAccountConfirmAction")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDataDeletionOpen}
        onClose={closeDataDeletion}
        title={t("dataDeletionTitle")}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("dataDeletionExplanation")}
          </p>
          <TextArea
            id="data-deletion-reason"
            label={t("dataDeletionReasonLabel")}
            placeholder={t("dataDeletionReasonPlaceholder")}
            value={dataDeletionReason}
            maxLength={1000}
            onChange={(e) => setDataDeletionReason(e.target.value)}
            helperText={`${dataDeletionReason.length}/1000`}
          />
          {dataDeletionError && (
            <div role="alert" className={errorBox}>
              {dataDeletionError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={closeDataDeletion}
              disabled={isRequestingDeletion}
            >
              {t("cancel")}
            </Button>
            <Button
              isLoading={isRequestingDeletion}
              onClick={() => void handleRequestDataDeletion()}
            >
              {t("dataDeletionSubmit")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
