"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FileUpload,
  LoadingSpinner,
  TabsList,
} from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import { bookingService, paymentService, ApiError } from "@/lib/api";
import { ArrowLeft, CheckCircle, Clock, CreditCard, AlertTriangle, Lock, University } from "lucide-react";

interface BookingPaymentDetails {
  id: string;
  bookingRef: string;
  status: string;
  trip: {
    startDate: string;
    endDate: string;
    pickupLocation: string;
    dropoffLocation: string;
    passengers: number;
  };
  vehicle: {
    name: string;
    image: string | null;
  };
  payment: {
    id: string | null;
    total: number;
    paid: number;
    status: string;
    method: string;
    receiptUrl?: string | null;
  };
}

interface PaymentPageContentProps {
  bookingId: string;
  locale: string;
}

type PaymentTab = "card" | "bank";

const fallbackBankDetails = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branch: "",
  referenceHint: "",
};

const statusConfig: Record<
  string,
  { icon: typeof Clock; variant: "warning" | "info" | "success" | "danger" | "secondary" }
> = {
  pending: { icon: Clock, variant: "warning" },
  processing: { icon: Clock, variant: "info" },
  completed: { icon: CheckCircle, variant: "success" },
  failed: { icon: AlertTriangle, variant: "danger" },
  refunded: { icon: CheckCircle, variant: "secondary" },
};

export default function PaymentPageContent({
  bookingId,
  locale,
}: PaymentPageContentProps) {
  const t = useTranslations("bookingPayment");
  const router = useRouter();
  const { isLoading: guardLoading } = useProtectedRoute();

  const [booking, setBooking] = useState<BookingPaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PaymentTab>("card");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState(fallbackBankDetails);
  const [receiptFile, setReceiptFile] = useState<{
    file: File;
    preview?: string;
  } | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [payhereForm, setPayhereForm] = useState<{
    actionUrl: string;
    payload: Record<string, string>;
  } | null>(null);

  const payhereFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (payhereForm && payhereFormRef.current) {
      payhereFormRef.current.submit();
    }
  }, [payhereForm]);

  useEffect(() => {
    if (!guardLoading) {
      fetchBooking();
    }
  }, [guardLoading, bookingId]);

  useEffect(() => {
    if (!guardLoading) {
      paymentService
        .getBankDetails()
        .then((response) => {
          setBankDetails(response.bankDetails || fallbackBankDetails);
        })
        .catch(() => {
          setBankDetails(fallbackBankDetails);
        });
    }
  }, [guardLoading]);

  const fetchBooking = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const response = await bookingService.getById(bookingId);
      const data =
        (response as unknown as { booking?: BookingPaymentDetails }).booking ??
        (response as unknown as BookingPaymentDetails);
      setBooking(data);
      setCurrentPaymentId(data.payment.id || null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("errors.load");
      setError(message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const paymentStatus = booking?.payment?.status?.toLowerCase() || "pending";
  const statusKey = statusConfig[paymentStatus] ? paymentStatus : "pending";
  const statusMeta = statusConfig[statusKey];
  const statusLabel = t(`status.${statusKey}`);
  const StatusIcon = statusMeta.icon;

  const dueAmount = useMemo(() => {
    if (!booking) return 0;
    const paid = booking.payment?.paid || 0;
    return Math.max(0, booking.payment.total - paid);
  }, [booking]);

  const handlePayNow = async () => {
    if (!booking) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    setError(null);

    const methodMap: Record<PaymentTab, "CARD" | "BANK_TRANSFER"> = {
      card: "CARD",
      bank: "BANK_TRANSFER",
    };

    try {
      const result = await paymentService.createPaymentIntent(
        booking.id,
        methodMap[activeTab],
      );

      if (result.payment?.id) {
        setCurrentPaymentId(result.payment.id);
      }

      if (result.payhere && activeTab === "card") {
        setPayhereForm(result.payhere);
        return;
      }

      setStatusMessage(t("bankReady"));

      await fetchBooking();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("errors.payment");
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    await fetchBooking(true);
    setIsRefreshing(false);
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile || !currentPaymentId) {
      setError(t("errors.selectReceipt"));
      return;
    }

    setIsUploadingReceipt(true);
    setError(null);
    try {
      await paymentService.uploadReceipt(currentPaymentId, receiptFile.file);
      setStatusMessage(t("receiptUploaded"));
      setReceiptFile(null);
      await fetchBooking(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("errors.upload");
      setError(message);
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  useEffect(() => {
    if (!booking) return;
    if (["completed", "refunded", "failed"].includes(paymentStatus)) return;

    const interval = setInterval(() => {
      fetchBooking(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [booking, paymentStatus]);

  if (guardLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p role="alert" className="text-[var(--color-text-secondary)] mb-4">{error || t("errors.notFound")}</p>
          <Button onClick={() => router.push(`/${locale}/dashboard/bookings`)}>
            {t("goToBookings")}
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: "card",
      label: t("tabs.card"),
      icon: <CreditCard className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: "bank",
      label: t("tabs.bank"),
      icon: <University className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface)] pb-12">
      <div className="bg-[var(--color-bg-base)] border-b border-[var(--color-border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/${locale}/dashboard/bookings/${booking.id}`}
                aria-label={t("backToBooking")}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
              >
                <ArrowLeft className="h-6 w-6" aria-hidden="true" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("title")}</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("reference", { ref: booking.bookingRef })}
                </p>
              </div>
            </div>
            <Badge variant={statusMeta.variant}>
              <span className="inline-flex items-center gap-2">
                <StatusIcon className="h-4 w-4" aria-hidden="true" />
                {statusLabel}
              </span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("chooseMethod")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <TabsList
                  activeTab={activeTab}
                  onTabChange={(tabId) => setActiveTab(tabId as PaymentTab)}
                  tabs={tabs}
                  variant="pills"
                />

                {activeTab === "card" && (
                  <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
                    <p>{t("cardRedirect")}</p>
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {t("cardSecure")}
                    </div>
                  </div>
                )}

                {activeTab === "bank" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                      <p className="font-semibold text-[var(--color-text-primary)]">
                        {bankDetails.bankName || t("bankDetails")}
                      </p>
                      {bankDetails.accountName && (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {t("accountName", { value: bankDetails.accountName })}
                        </p>
                      )}
                      {bankDetails.accountNumber && (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {t("accountNumber", { value: bankDetails.accountNumber })}
                        </p>
                      )}
                      {bankDetails.branch && (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {t("branch", { value: bankDetails.branch })}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      {bankDetails.referenceHint || t("referenceHint")}
                    </div>

                    <FileUpload
                      label={t("receiptLabel")}
                      value={receiptFile}
                      onChange={setReceiptFile}
                      helpText={t("receiptHelp")}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />

                    {booking.payment.receiptUrl && (
                      <a
                        href={booking.payment.receiptUrl}
                        className="text-sm text-[var(--color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("viewReceipt")}
                      </a>
                    )}

                    <Button
                      variant="outline"
                      isLoading={isUploadingReceipt}
                      onClick={handleUploadReceipt}
                      disabled={!currentPaymentId || !receiptFile}
                    >
                      {t("uploadReceipt")}
                    </Button>
                  </div>
                )}

                {statusMessage && (
                  <div role="status" className="rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-4 text-sm text-[var(--color-success-text)]">
                    {statusMessage}
                  </div>
                )}

                {error && (
                  <div role="alert" className="rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  isLoading={isSubmitting}
                  onClick={handlePayNow}
                  disabled={paymentStatus === "completed"}
                >
                  {paymentStatus === "completed" ? t("paid") : t("payNow")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("paymentStatus")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-3">
                  <StatusIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {statusLabel}
                    </p>
                    <p>
                      {paymentStatus === "completed"
                        ? t("confirmed")
                        : t("completeToConfirm")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isRefreshing}
                  onClick={handleRefreshStatus}
                >
                  {t("refresh")}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("summary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>{t("total")}</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {t("amount", { amount: booking.payment.total.toLocaleString() })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>{t("paidAmount")}</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {t("amount", { amount: (booking.payment.paid || 0).toLocaleString() })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>{t("due")}</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {t("amount", { amount: dueAmount.toLocaleString() })}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("security")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {t("pci")}
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {t("encrypted")}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {payhereForm && (
        <form
          ref={payhereFormRef}
          method="POST"
          action={payhereForm.actionUrl}
          className="hidden"
        >
          {Object.entries(payhereForm.payload).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      )}
    </div>
  );
}
