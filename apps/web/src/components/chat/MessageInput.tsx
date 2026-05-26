"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface MessageInputProps {
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
}

const MAX_LENGTH = 2000;
const MAX_HEIGHT_PX = 144; // ~6 lines

type InputError = "empty" | "tooLong" | "sendFailed";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

export function MessageInput({ disabled, onSend }: MessageInputProps) {
  const t = useTranslations("messages");
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<InputError | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autosize: shrink to single-line, then grow up to MAX_HEIGHT_PX. Keeps
  // the input footprint small while letting longer messages stay visible.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
  }, [value]);

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
      // Restore focus so the customer can keep typing without re-clicking.
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
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
    // Enter sends; Shift+Enter inserts a newline — common chat convention.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && !disabled) void submit();
    }
  };

  const charsRemaining = MAX_LENGTH - value.length;
  const showCounter = charsRemaining < 200;
  const counterColor =
    charsRemaining < 0
      ? "text-[var(--color-error-text)]"
      : charsRemaining < 50
        ? "text-[var(--color-error-text)]"
        : "text-[var(--color-text-tertiary)]";
  const canSend = !sending && !disabled && value.trim().length > 0;

  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-3 md:p-4"
      aria-label={t("composerLabel", { defaultValue: "Send a message" })}
    >
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="chat-message-input">
          {t("inputPlaceholder")}
        </label>
        <div
          className={`flex-1 rounded-2xl border transition-colors ${
            error
              ? "border-[var(--color-error-border)]"
              : "border-[var(--color-border-default)] focus-within:border-[var(--color-action-primary)] focus-within:ring-2 focus-within:ring-[var(--color-action-focus)] focus-within:ring-offset-2"
          } bg-[var(--color-bg-surface)]`}
        >
          <textarea
            id="chat-message-input"
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error && e.target.value.trim()) setError(null);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("inputPlaceholder")}
            disabled={disabled || sending}
            maxLength={MAX_LENGTH + 100}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "chat-input-error" : undefined}
            className="block w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-sm leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none disabled:opacity-50"
            style={{ maxHeight: `${MAX_HEIGHT_PX}px` }}
          />
        </div>
        <button
          type="submit"
          disabled={!canSend}
          aria-label={t("send")}
          title={t("sendHint", {
            defaultValue: "Press Enter to send · Shift+Enter for a new line",
          })}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-primary)] text-white shadow-sm transition-all hover:bg-[var(--color-action-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:bg-[var(--color-action-disabled)] disabled:shadow-none ${focusRing}`}
        >
          {sending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[11px]">
        {error ? (
          <p
            id="chat-input-error"
            role="alert"
            className="text-[var(--color-error-text)]"
          >
            {t(`validation.${error as "empty"}`)}
          </p>
        ) : (
          <p className="text-[var(--color-text-tertiary)]">
            {t("sendHint", {
              defaultValue:
                "Press Enter to send · Shift+Enter for a new line",
            })}
          </p>
        )}
        {showCounter ? (
          <span className={`shrink-0 ${counterColor}`} aria-live="polite">
            {charsRemaining}
          </span>
        ) : null}
      </div>
    </form>
  );
}
