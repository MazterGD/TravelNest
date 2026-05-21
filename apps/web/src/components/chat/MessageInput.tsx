"use client";

import { useState, type FormEvent, type KeyboardEvent, useRef } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";

interface MessageInputProps {
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
}

const MAX_LENGTH = 2000;

type InputError = "empty" | "tooLong" | "sendFailed";

export function MessageInput({ disabled, onSend }: MessageInputProps) {
  const t = useTranslations("messages");
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<InputError | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("empty");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError("tooLong");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await onSend(trimmed);
      setValue("");
    } catch {
      // A rejected send is a network/server failure, not empty input — surface
      // the correct message so the user knows the send did not go through.
      setError("sendFailed");
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sending && !disabled) void submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && !disabled) void submit();
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-4"
    >
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="chat-message-input">
          {t("inputPlaceholder")}
        </label>
        <textarea
          id="chat-message-input"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          placeholder={t("inputPlaceholder")}
          disabled={disabled || sending}
          maxLength={MAX_LENGTH + 100}
          className="min-h-[44px] max-h-32 flex-1 resize-none rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || value.trim().length === 0}
          aria-label={t("send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--color-action-primary)] text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] disabled:bg-[var(--color-text-tertiary)] disabled:cursor-not-allowed"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-[var(--color-error-text)]"
        >
          {t(`validation.${error as "empty"}`)}
        </p>
      )}
    </form>
  );
}
