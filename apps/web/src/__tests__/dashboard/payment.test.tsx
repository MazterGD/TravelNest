/**
 * Booking payment page: PayHere card hand-off, bank transfer + receipt upload,
 * status refresh/polling and the payment summary.
 */
import { configure, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  push: vi.fn(),
  guard: { isLoading: false },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  usePathname: () => "/en/dashboard/bookings/b1/payment",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/components/ui", async (importOriginal: any) => ({
  ...(await importOriginal()),
  FileUpload: ({ label, onChange, value }: any) => (
    <div>
      <span>{label}</span>
      <button type="button" onClick={() => onChange({ file: new File(["x"], "receipt.pdf") })}>choose-receipt</button>
      {value ? <span>{value.file.name}</span> : null}
    </div>
  ),
}));
vi.mock("@/hooks", async (importOriginal: any) => ({
  ...(await importOriginal()),
  useProtectedRoute: () => h.guard,
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  bookingService: { getById: vi.fn() },
  paymentService: { getBankDetails: vi.fn(), createPaymentIntent: vi.fn(), uploadReceipt: vi.fn() },
}));

import PaymentPageContent from "@/app/[locale]/dashboard/bookings/[id]/payment/PaymentPageContent";
import { ApiError, bookingService, paymentService } from "@/lib/api";

const getById = bookingService.getById as any;
const bank = paymentService.getBankDetails as any;
const intent = paymentService.createPaymentIntent as any;
const upload = paymentService.uploadReceipt as any;

const booking = (payment: Record<string, any> = {}) => ({
  id: "b1",
  bookingRef: "BK-001",
  status: "PENDING",
  trip: { startDate: "2026-12-01", endDate: "2026-12-02", pickupLocation: "Colombo", dropoffLocation: "Kandy", passengers: 20 },
  vehicle: { name: "Lanka Coach", image: null },
  payment: { id: "p1", total: 50000, paid: 10000, status: "PENDING", method: "CARD", receiptUrl: null, ...payment },
});

const renderPayment = async (data: any = booking()) => {
  getById.mockResolvedValue(data);
  render(<PaymentPageContent bookingId="b1" locale="en" />);
  await screen.findByText("Choose a payment method");
};

let submitSpy: any;
beforeEach(() => {
  vi.clearAllMocks();
  h.guard.isLoading = false;
  bank.mockResolvedValue({ bankDetails: { bankName: "BOC", accountName: "TraveNest", accountNumber: "123", branch: "Colombo", referenceHint: "Use BK ref" } });
  // jsdom does not implement form submission.
  submitSpy = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PaymentPageContent", () => {
  it("waits for the route guard before loading anything", () => {
    h.guard.isLoading = true;
    render(<PaymentPageContent bookingId="b1" locale="en" />);
    expect(getById).not.toHaveBeenCalled();
    expect(bank).not.toHaveBeenCalled();
  });

  it("shows the summary with the outstanding amount", async () => {
    await renderPayment({ booking: booking() });
    expect(screen.getByText("Booking reference: BK-001")).toBeTruthy();
    expect(screen.getAllByText("Pending").length).toBe(2);
    expect(screen.getByText("LKR 50,000")).toBeTruthy();
    expect(screen.getByText("LKR 10,000")).toBeTruthy();
    expect(screen.getByText("LKR 40,000")).toBeTruthy();
    expect(screen.getByText("Complete payment to confirm your booking.")).toBeTruthy();
    expect(screen.getByText("Card details are processed securely by PayHere.")).toBeTruthy();
  });

  it("hands card payments off to PayHere via an auto-submitted form", async () => {
    intent.mockResolvedValue({
      payment: { id: "p2" },
      payhere: { actionUrl: "https://sandbox.payhere.lk/pay/checkout", payload: { merchant_id: "M1", order_id: "BK-001" } },
    });
    await renderPayment();
    fireEvent.click(screen.getByText("Pay Now"));
    await waitFor(() => expect(submitSpy).toHaveBeenCalled());
    expect(intent).toHaveBeenCalledWith("b1", "CARD");
    const form = document.querySelector('form[method="POST"]') as HTMLFormElement;
    expect(form.getAttribute("action")).toBe("https://sandbox.payhere.lk/pay/checkout");
    expect((form.querySelector('input[name="merchant_id"]') as HTMLInputElement).value).toBe("M1");
  });

  it("bank transfer shows instructions, then uploads a receipt", async () => {
    intent.mockResolvedValue({ payment: { id: "p9" } });
    upload.mockResolvedValue({});
    await renderPayment(booking({ id: null, receiptUrl: "https://r/1" }));
    fireEvent.click(screen.getByText("Bank Transfer"));
    await waitFor(() => expect(screen.getByText("BOC")).toBeTruthy());
    expect(screen.getByText("Account Name: TraveNest")).toBeTruthy();
    expect(screen.getByText("Account Number: 123")).toBeTruthy();
    expect(screen.getByText("Branch: Colombo")).toBeTruthy();
    expect(screen.getByText("View uploaded receipt").getAttribute("href")).toBe("https://r/1");
    const uploadBtn = screen.getByText("Upload Receipt").closest("button")!;
    expect(uploadBtn.disabled).toBe(true);
    getById.mockResolvedValue(booking({ id: "p9", receiptUrl: "https://r/1" }));
    fireEvent.click(screen.getByText("Pay Now"));
    expect(await screen.findByText(/Bank transfer instructions are ready/)).toBeTruthy();
    expect(intent).toHaveBeenCalledWith("b1", "BANK_TRANSFER");
    expect(getById).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText("Bank Transfer"));
    fireEvent.click(screen.getByText("choose-receipt"));
    expect(screen.getByText("receipt.pdf")).toBeTruthy();
    fireEvent.click(screen.getByText("Upload Receipt"));
    expect(await screen.findByText("Receipt uploaded. We will confirm your payment soon.")).toBeTruthy();
    expect(upload).toHaveBeenCalledWith("p9", expect.any(File));
  });

  it("surfaces payment intent errors", async () => {
    intent.mockRejectedValueOnce(new ApiError(400, "Booking already paid")).mockRejectedValueOnce(new Error("x"));
    await renderPayment();
    fireEvent.click(screen.getByText("Pay Now"));
    expect(await screen.findByText("Booking already paid")).toBeTruthy();
    fireEvent.click(screen.getByText("Pay Now"));
    expect(await screen.findByText("Payment failed")).toBeTruthy();
  });

  it("surfaces receipt upload errors", async () => {
    upload.mockRejectedValueOnce(new ApiError(413, "File too large")).mockRejectedValueOnce(new Error("x"));
    await renderPayment();
    fireEvent.click(screen.getByText("Bank Transfer"));
    fireEvent.click(screen.getByText("choose-receipt"));
    fireEvent.click(screen.getByText("Upload Receipt"));
    expect(await screen.findByText("File too large")).toBeTruthy();
    fireEvent.click(screen.getByText("Upload Receipt"));
    expect(await screen.findByText("Receipt upload failed")).toBeTruthy();
  });

  it("falls back to generic bank details when none are configured or the call fails", async () => {
    bank.mockResolvedValueOnce({});
    await renderPayment(booking({ paid: 0 }));
    fireEvent.click(screen.getByText("Bank Transfer"));
    expect(await screen.findByText("Bank details")).toBeTruthy();
    expect(screen.getByText("Use your booking reference as the payment note.")).toBeTruthy();
    expect(screen.getAllByText("LKR 50,000").length).toBe(2);
  });

  it("keeps the fallback bank details when the bank-details call fails", async () => {
    bank.mockRejectedValueOnce(new Error("x"));
    await renderPayment();
    fireEvent.click(screen.getByText("Bank Transfer"));
    expect(await screen.findByText("Bank details")).toBeTruthy();
  });

  it("refreshes the status on demand and shows a confirmed payment", async () => {
    await renderPayment();
    getById.mockResolvedValue(booking({ status: "COMPLETED", paid: 50000 }));
    fireEvent.click(screen.getByText("Refresh status"));
    expect(await screen.findByText("Your payment is confirmed.")).toBeTruthy();
    expect(screen.getByText("Paid", { selector: "button" }).closest("button")!.disabled).toBe(true);
    expect(screen.getAllByText("Completed").length).toBe(2);
  });

  it.each([
    ["processing", "Processing"],
    ["failed", "Failed"],
    ["refunded", "Refunded"],
    ["weird", "Pending"],
  ])("labels a %s payment as %s", async (status: string, label: string) => {
    await renderPayment(booking({ status }));
    expect(screen.getAllByText(label).length).toBe(2);
  });

  it("polls a pending payment every 10 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderPayment();
    expect(getById).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_500);
    });
    await waitFor(() => expect(getById.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(getById.mock.calls.every((c: any[]) => c[0] === "b1")).toBe(true);
  });

  it("does not poll a settled payment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderPayment(booking({ status: "COMPLETED" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getById).toHaveBeenCalledTimes(1);
  });

  it("shows not-found when the booking cannot be loaded", async () => {
    getById.mockRejectedValueOnce(new ApiError(404, "Booking missing"));
    const first = render(<PaymentPageContent bookingId="b1" locale="en" />);
    fireEvent.click(await screen.findByText("Go to Bookings"));
    expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings");
    first.unmount();
    getById.mockRejectedValueOnce(new Error("x"));
    render(<PaymentPageContent bookingId="b1" locale="en" />);
    expect(await screen.findByText("Booking not found")).toBeTruthy();
  });

  it.todo("shows the API error message (e.g. 'Booking missing') when the booking fails to load, instead of a generic 'Booking not found'");
});
