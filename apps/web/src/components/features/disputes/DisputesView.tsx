"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, MessageSquare, Plus, RefreshCw, Send } from "lucide-react";
import {
  Badge,
  Button,
  EmptyBoxIcon,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonList,
  TextArea,
} from "@/components/ui";
import {
  disputeService,
  ApiError,
  type DisputeDetail,
  type DisputeListItem,
  type DisputeStatus,
  type DisputeType,
} from "@/lib/api";
import { useAuthStore } from "@/store";

type RoleFilter = "all" | "raised" | "against";

const STATUS_VARIANT: Record<
  DisputeStatus,
  "success" | "danger" | "warning" | "info" | "secondary"
> = {
  OPEN: "info",
  INVESTIGATING: "warning",
  RESOLVED: "success",
  CLOSED: "secondary",
  ESCALATED: "danger",
};

const DISPUTE_TYPES: DisputeType[] = [
  "BOOKING_QUALITY_ISSUE",
  "CANCELLATION_DISPUTE",
  "PAYMENT_ISSUE",
  "VEHICLE_CONDITION",
  "BEHAVIOR_COMPLAINT",
  "SERVICE_NOT_PROVIDED",
  "OTHER",
];

interface DisputesViewProps {
  locale: string;
  bookingOptions: { id: string; label: string }[];
  bookingsLoading?: boolean;
}

export function DisputesView({
  locale,
  bookingOptions,
  bookingsLoading = false,
}: DisputesViewProps) {
  const t = useTranslations("dispute");
  const currentUser = useAuthStore((state) => state.user);

  const [disputes, setDisputes] = useState<DisputeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  // Detail modal
  const [selected, setSelected] = useState<DisputeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Raise modal
  const [isRaiseOpen, setIsRaiseOpen] = useState(false);
  const [form, setForm] = useState({
    bookingId: "",
    type: "BOOKING_QUALITY_ISSUE" as DisputeType,
    subject: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await disputeService.list({ role: roleFilter, limit: 50 });
      setDisputes(data.disputes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, t]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setSelected(null);
    setReplyText("");
    try {
      const data = await disputeService.get(id);
      setSelected(data.dispute);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("loadError"));
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReply = async () => {
    if (!selected || replyText.trim().length < 3) return;
    setIsSending(true);
    try {
      await disputeService.reply(selected.id, replyText.trim());
      setReplyText("");
      const refreshed = await disputeService.get(selected.id);
      setSelected(refreshed.dispute);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("replyError"));
    } finally {
      setIsSending(false);
    }
  };

  const submitRaise = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.bookingId ||
      form.subject.trim().length < 3 ||
      form.description.trim().length < 10
    ) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await disputeService.create({
        bookingId: form.bookingId,
        type: form.type,
        subject: form.subject.trim(),
        description: form.description.trim(),
      });
      setIsRaiseOpen(false);
      setForm({
        bookingId: "",
        type: "BOOKING_QUALITY_ISSUE",
        subject: "",
        description: "",
      });
      await fetchList();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("createError"));
    } finally {
      setSubmitting(false);
    }
  };

  const roleFilters: { value: RoleFilter; label: string }[] = [
    { value: "all", label: t("filterAll") },
    { value: "raised", label: t("filterRaised") },
    { value: "against", label: t("filterAgainst") },
  ];

  const typeOptions = DISPUTE_TYPES.map((type) => ({
    value: type,
    label: t(`type${type}`),
  }));

  const bookingSelectOptions = [
    { value: "", label: t("selectBooking") },
    ...bookingOptions.map((b) => ({ value: b.id, label: b.label })),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 lg:px-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button
            onClick={() => setIsRaiseOpen(true)}
            disabled={bookingsLoading || bookingOptions.length === 0}
          >
            <Plus size={16} />
            {t("raiseButton")}
          </Button>
        }
      />

      {/* Role filter pills */}
      <div className="flex flex-wrap gap-2">
        {roleFilters.map((rf) => {
          const active = roleFilter === rf.value;
          return (
            <button
              key={rf.value}
              type="button"
              onClick={() => setRoleFilter(rf.value)}
              aria-pressed={active}
              className={
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2 " +
                (active
                  ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)]")
              }
            >
              {rf.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-text)]"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
          <button
            onClick={() => void fetchList()}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-error-border)] px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
          >
            <RefreshCw size={12} />
            {t("retry")}
          </button>
        </div>
      )}

      {isLoading ? (
        <SkeletonList count={3} />
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={<EmptyBoxIcon />}
          title={t("noDisputes")}
          description={t("noDisputesDescription")}
        />
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <button
              key={dispute.id}
              type="button"
              onClick={() => void openDetail(dispute.id)}
              className="block w-full rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6 text-left transition-colors hover:border-[var(--color-action-primary)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {dispute.subject}
                    </h3>
                    <Badge variant={STATUS_VARIANT[dispute.status]} dot>
                      {t(`status${dispute.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {t("code")}: <span className="font-mono">{dispute.disputeCode}</span>
                    {" · "}
                    {t(`type${dispute.type}`)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    {dispute.isRaisedByMe ? t("raisedByYou") : t("raisedAgainstYou")}
                    {" · "}
                    {t("vehicle")}: {dispute.booking.vehicle.name}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {new Date(dispute.createdAt).toLocaleDateString(locale)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={Boolean(selected) || detailLoading}
        onClose={() => {
          setSelected(null);
          setReplyText("");
        }}
        title={selected ? selected.subject : t("title")}
        size="full"
      >
        {detailLoading || !selected ? (
          <p className="py-6 text-sm text-[var(--color-text-tertiary)]">…</p>
        ) : (
          <div className="max-h-[calc(90vh-8rem)] space-y-5 overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[selected.status]} dot>
                {t(`status${selected.status}`)}
              </Badge>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {t("code")}: <span className="font-mono">{selected.disputeCode}</span>
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                · {t(`type${selected.type}`)}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {t("vehicle")}: {selected.booking.vehicle.name}
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {selected.description}
              </p>
            </div>

            {selected.status === "RESOLVED" && selected.resolution && (
              <div className="rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-success-text)]">
                  {t("resolution")}
                </p>
                <p className="mt-1 text-sm text-[var(--color-success-text)]">
                  {selected.resolution}
                </p>
              </div>
            )}

            {/* Thread */}
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                <MessageSquare size={16} />
                {t("thread")}
              </p>
              {selected.messages.length === 0 ? (
                <p className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-xs text-[var(--color-text-tertiary)]">
                  {t("noMessages")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {selected.messages.map((message) => {
                    const isMine = message.sender.id === currentUser?.id;
                    return (
                      <li
                        key={message.id}
                        className={isMine ? "flex justify-end" : "flex justify-start"}
                      >
                        <div
                          className={
                            "max-w-[80%] rounded-xl border p-3 " +
                            (isMine
                              ? "border-[var(--color-action-primary)]/30 bg-[var(--color-action-primary)]/5"
                              : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]")
                          }
                        >
                          <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                            {isMine
                              ? t("you")
                              : `${message.sender.firstName} ${message.sender.lastName}`}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                            {message.message}
                          </p>
                          <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                            {new Date(message.createdAt).toLocaleString(locale)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Reply box */}
            {selected.status === "RESOLVED" || selected.status === "CLOSED" ? (
              <p className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 text-xs text-[var(--color-text-tertiary)]">
                {t("closedNotice")}
              </p>
            ) : (
              <div className="space-y-2">
                <TextArea
                  label={t("reply")}
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t("replyPlaceholder")}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => void submitReply()}
                    isLoading={isSending}
                    disabled={isSending || replyText.trim().length < 3}
                  >
                    <Send size={16} />
                    {isSending ? t("sending") : t("send")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Raise modal */}
      <Modal
        isOpen={isRaiseOpen}
        onClose={() => setIsRaiseOpen(false)}
        title={t("raiseTitle")}
        size="md"
      >
        {bookingOptions.length === 0 ? (
          <p className="py-4 text-sm text-[var(--color-text-tertiary)]">
            {t("noBookings")}
          </p>
        ) : (
          <form onSubmit={submitRaise} className="space-y-3">
            <Select
              label={t("fieldBooking")}
              options={bookingSelectOptions}
              value={form.bookingId}
              onChange={(v) => setForm((p) => ({ ...p, bookingId: v }))}
            />
            <Select
              label={t("fieldType")}
              options={typeOptions}
              value={form.type}
              onChange={(v) => setForm((p) => ({ ...p, type: v as DisputeType }))}
            />
            <Input
              label={t("fieldSubject")}
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder={t("subjectPlaceholder")}
              maxLength={200}
            />
            <TextArea
              label={t("fieldDescription")}
              rows={5}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder={t("descriptionPlaceholder")}
              maxLength={3000}
            />
            {formError && (
              <p role="alert" className="text-sm text-[var(--color-error-text)]">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRaiseOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                isLoading={submitting}
                disabled={
                  submitting ||
                  !form.bookingId ||
                  form.subject.trim().length < 3 ||
                  form.description.trim().length < 10
                }
              >
                {submitting ? t("submitting") : t("submit")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
