"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FileUpload,
  Input,
  LoadingSpinner,
  TabsList,
} from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import { bookingService, paymentService, ApiError } from "@/lib/api";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaCreditCard,
  FaExclamationTriangle,
  FaLock,
  FaMoneyBillWave,
  FaUniversity,
} from "react-icons/fa";

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

type PaymentTab = "card" | "bank" | "cash";

const fallbackBankDetails = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branch: "",
  referenceHint: "Use your booking reference as the payment note.",
};

const statusConfig: Record<
  string,
  { label: string; icon: typeof FaClock; className: string }
> = {
  pending: {
    label: "Pending",
    icon: FaClock,
    className: "bg-yellow-100 text-yellow-800",
  },
  processing: {
    label: "Processing",
    icon: FaClock,
    className: "bg-blue-100 text-blue-800",
  },
  completed: {
    label: "Completed",
    icon: FaCheckCircle,
    className: "bg-green-100 text-green-800",
  },
  failed: {
    label: "Failed",
    icon: FaExclamationTriangle,
    className: "bg-red-100 text-red-800",
  },
  refunded: {
    label: "Refunded",
    icon: FaCheckCircle,
    className: "bg-purple-100 text-purple-800",
  },
};

export default function PaymentPageContent({
  bookingId,
  locale,
}: PaymentPageContentProps) {
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
        err instanceof ApiError ? err.message : "Failed to load booking";
      setError(message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const paymentStatus = booking?.payment?.status?.toLowerCase() || "pending";
  const statusMeta = statusConfig[paymentStatus] || statusConfig.pending;
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

    const methodMap: Record<PaymentTab, "CARD" | "BANK_TRANSFER" | "CASH"> = {
      card: "CARD",
      bank: "BANK_TRANSFER",
      cash: "CASH",
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

      setStatusMessage(
        activeTab === "cash"
          ? "Cash payment selected. Please pay the driver on pickup."
          : "Bank transfer instructions are ready. Use your booking reference for the transfer.",
      );

      await fetchBooking();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Payment failed";
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
      setError("Select a receipt file first");
      return;
    }

    setIsUploadingReceipt(true);
    setError(null);
    try {
      await paymentService.uploadReceipt(currentPaymentId, receiptFile.file);
      setStatusMessage("Receipt uploaded. We will confirm your payment soon.");
      setReceiptFile(null);
      await fetchBooking(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Receipt upload failed";
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
          <p className="text-gray-600 mb-4">Booking not found</p>
          <Button onClick={() => router.push(`/${locale}/dashboard/bookings`)}>
            Go to Bookings
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: "card",
      label: "Credit/Debit Card",
      icon: <FaCreditCard className="text-sm" />,
    },
    {
      id: "bank",
      label: "Bank Transfer",
      icon: <FaUniversity className="text-sm" />,
    },
    {
      id: "cash",
      label: "Cash (Pay Later)",
      icon: <FaMoneyBillWave className="text-sm" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/${locale}/dashboard/bookings/${booking.id}`}
                className="text-gray-600 hover:text-[#20B0E9] transition-colors"
              >
                <FaArrowLeft className="text-xl" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Payment</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Booking reference: {booking.bookingRef}
                </p>
              </div>
            </div>
            <Badge className={statusMeta.className}>
              <span className="inline-flex items-center gap-2">
                <StatusIcon className="text-sm" />
                {statusMeta.label}
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
                <CardTitle>Choose a payment method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <TabsList
                  activeTab={activeTab}
                  onTabChange={(tabId) => setActiveTab(tabId as PaymentTab)}
                  tabs={tabs}
                  variant="pills"
                />

                {activeTab === "card" && (
                  <div className="space-y-4">
                    <Input label="Cardholder Name" placeholder="Name on card" />
                    <Input
                      label="Card Number"
                      placeholder="1234 5678 9012 3456"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Expiry Date" placeholder="MM/YY" />
                      <Input label="CVC" placeholder="123" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FaLock className="text-[#20B0E9]" />
                      Card details are processed securely by PayHere.
                    </div>
                  </div>
                )}

                {activeTab === "bank" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="font-semibold text-gray-900">
                        {bankDetails.bankName || "Bank details"}
                      </p>
                      {bankDetails.accountName && (
                        <p className="text-sm text-gray-600">
                          Account Name: {bankDetails.accountName}
                        </p>
                      )}
                      {bankDetails.accountNumber && (
                        <p className="text-sm text-gray-600">
                          Account Number: {bankDetails.accountNumber}
                        </p>
                      )}
                      {bankDetails.branch && (
                        <p className="text-sm text-gray-600">
                          Branch: {bankDetails.branch}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {bankDetails.referenceHint}
                    </div>

                    <FileUpload
                      label="Upload payment receipt"
                      value={receiptFile}
                      onChange={setReceiptFile}
                      helpText="Upload a PDF, JPG, or PNG receipt."
                      accept=".pdf,.jpg,.jpeg,.png"
                    />

                    {booking.payment.receiptUrl && (
                      <a
                        href={booking.payment.receiptUrl}
                        className="text-sm text-[#20B0E9] hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View uploaded receipt
                      </a>
                    )}

                    <Button
                      variant="outline"
                      isLoading={isUploadingReceipt}
                      onClick={handleUploadReceipt}
                      disabled={!currentPaymentId || !receiptFile}
                    >
                      Upload Receipt
                    </Button>
                  </div>
                )}

                {activeTab === "cash" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Pay in cash on the day of your trip. Please keep the exact
                    amount ready.
                  </div>
                )}

                {statusMessage && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    {statusMessage}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
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
                  {paymentStatus === "completed" ? "Paid" : "Pay Now"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-3">
                  <StatusIcon className="text-[#20B0E9]" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {statusMeta.label}
                    </p>
                    <p>
                      {paymentStatus === "completed"
                        ? "Your payment is confirmed."
                        : "Complete payment to confirm your booking."}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isRefreshing}
                  onClick={handleRefreshStatus}
                >
                  Refresh status
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Total amount</span>
                  <span className="font-medium text-gray-900">
                    LKR {booking.payment.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Paid</span>
                  <span className="font-medium text-gray-900">
                    LKR {booking.payment.paid.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Amount due</span>
                  <span className="font-semibold text-gray-900">
                    LKR {dueAmount.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <FaLock className="text-[#20B0E9]" />
                  PCI compliant payment processing
                </div>
                <div className="flex items-center gap-2">
                  <FaLock className="text-[#20B0E9]" />
                  Encrypted checkout powered by PayHere
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
