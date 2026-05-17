"use client";

import { useCallback, useState } from "react";
import { Button, ConfirmDialog, Input, Modal } from "@/components/ui";
import { useTranslations } from "next-intl";

type PromptConfig = {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  type?: "text" | "password" | "number";
  minLength?: number;
  confirmText?: string;
  cancelText?: string;
};

type PromptState = PromptConfig & {
  value: string;
  error: string | null;
  resolve: (value: string | null) => void;
};

type ConfirmConfig = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
};

type ConfirmState = ConfirmConfig & {
  resolve: (value: boolean) => void;
};

export const useDialogPrompts = () => {
  const t = useTranslations("common");
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const prompt = useCallback((config: PromptConfig) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({
        ...config,
        value: config.defaultValue ?? "",
        error: null,
        resolve,
      });
    });
  }, []);

  const confirm = useCallback((config: ConfirmConfig) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        ...config,
        resolve,
      });
    });
  }, []);

  const closePrompt = useCallback(() => {
    setPromptState((current) => {
      if (current) {
        current.resolve(null);
      }

      return null;
    });
  }, []);

  const submitPrompt = useCallback(() => {
    setPromptState((current) => {
      if (!current) {
        return current;
      }

      const normalized = current.value.trim();
      if (current.minLength && normalized.length < current.minLength) {
        return {
          ...current,
          error: `Minimum ${current.minLength} characters required.`,
        };
      }

      current.resolve(current.value);
      return null;
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState((current) => {
      if (current) {
        current.resolve(false);
      }

      return null;
    });
  }, []);

  const submitConfirm = useCallback(async () => {
    setConfirmState((current) => {
      if (current) {
        current.resolve(true);
      }

      return null;
    });
  }, []);

  const dialogs = (
    <>
      <Modal
        isOpen={Boolean(promptState)}
        onClose={closePrompt}
        title={promptState?.title}
        size="sm"
      >
        {promptState && (
          <div className="space-y-4">
            {promptState.message ? (
              <p className="text-sm text-muted-foreground">{promptState.message}</p>
            ) : null}

            <Input
              autoFocus
              type={promptState.type || "text"}
              value={promptState.value}
              placeholder={promptState.placeholder}
              onChange={(event) => {
                const nextValue = event.target.value;
                setPromptState((current) =>
                  current
                    ? {
                        ...current,
                        value: nextValue,
                        error: null,
                      }
                    : current,
                );
              }}
            />

            {promptState.error ? (
              <p className="text-sm text-error">{promptState.error}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closePrompt}
              >
                {promptState.cancelText || t("cancel")}
              </Button>
              <Button type="button" onClick={submitPrompt}>
                {promptState.confirmText || t("confirm")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmState)}
        onClose={closeConfirm}
        onConfirm={submitConfirm}
        title={confirmState?.title || ""}
        message={confirmState?.message || ""}
        confirmText={confirmState?.confirmText}
        cancelText={confirmState?.cancelText}
        variant={confirmState?.variant || "danger"}
      />
    </>
  );

  return {
    prompt,
    confirm,
    dialogs,
  };
};
