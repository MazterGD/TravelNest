"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Wallet,
  CalendarRange,
  CircleDollarSign,
  TrendingUp,
  Receipt,
  Landmark,
  Pencil,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { ownerService, ApiError } from "@/lib/api";

type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";
type SettlementStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

interface EarningsSummary {
  lifetimeEarnings: number;
  thisMonthEarnings: number;
  thisYearEarnings: number;
  pendingBalance: number;
}

interface Transaction {
  id: string;
  date: string;
  bookingId: string;
  bookingRef: string;
  route: string;
  amount: number;
  currency: string;
  method: string | null;
  status: PaymentStatus;
}

interface Settlement {
  id: string;
  settlementCode: string;
  period: string;
  totalBookings: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  status: SettlementStatus;
  processedAt: string | null;
  createdAt: string;
}

interface BankAccount {
  id: string;
  accountHolderName: string;
  accountNumberMasked: string | null;
  bankName: string;
  bankCode: string | null;
  branchName: string | null;
  branchCode: string | null;
  isPrimary: boolean;
  updatedAt: string;
}

interface BankFormState {
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
}

const EMPTY_BANK_FORM: BankFormState = {
  accountHolderName: "",
  accountNumber: "",
  bankName: "",
  bankCode: "",
  branchName: "",
  branchCode: "",
};

const TRANSACTIONS_PER_PAGE = 10;

function getPaymentStatusClasses(status: PaymentStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-[var(--color-success-bg)] text-success-foreground";
    case "PROCESSING":
      return "bg-primary/10 text-primary";
    case "FAILED":
      return "bg-[var(--color-error-bg)] text-error-foreground";
    case "PENDING":
    case "REFUNDED":
      return "bg-muted text-muted-foreground";
  }
}

function getSettlementStatusClasses(status: SettlementStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-[var(--color-success-bg)] text-success-foreground";
    case "PROCESSING":
      return "bg-primary/10 text-primary";
    case "FAILED":
    case "CANCELLED":
      return "bg-[var(--color-error-bg)] text-error-foreground";
    case "PENDING":
      return "bg-muted text-muted-foreground";
  }
}

export default function OwnerEarningsPage() {
  const t = useTranslations("ownerEarnings");
  const params = useParams();
  const locale = params.locale as string;
  const { user } = useAuthStore();
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txStatusFilter, setTxStatusFilter] = useState<PaymentStatus | "">("");
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState<BankFormState>(EMPTY_BANK_FORM);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  const currency = t("currency");
  const formatAmount = (value: number) =>
    `${currency} ${value.toLocaleString()}`;

  const loadCoreData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryRes, settlementsRes, bankRes] = await Promise.all([
        ownerService.getEarningsSummary(),
        ownerService.getEarningsSettlements(),
        ownerService.getBankAccount(),
      ]);
      setSummary(summaryRes);
      setSettlements(Array.isArray(settlementsRes) ? settlementsRes : []);
      setBankAccount(bankRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const loadTransactions = useCallback(async () => {
    setIsTxLoading(true);
    try {
      const res = await ownerService.getEarningsTransactions({
        page: txPage,
        limit: TRANSACTIONS_PER_PAGE,
        status: txStatusFilter || undefined,
      });
      setTransactions(res.transactions);
      setTxTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.loadFailed"));
    } finally {
      setIsTxLoading(false);
    }
  }, [txPage, txStatusFilter, t]);

  useEffect(() => {
    if (user && isAuthorized) loadCoreData();
  }, [user, isAuthorized, loadCoreData]);

  useEffect(() => {
    if (user && isAuthorized) loadTransactions();
  }, [user, isAuthorized, loadTransactions]);

  const openBankEditor = () => {
    setBankForm(
      bankAccount
        ? {
            accountHolderName: bankAccount.accountHolderName,
            accountNumber: "",
            bankName: bankAccount.bankName,
            bankCode: bankAccount.bankCode ?? "",
            branchName: bankAccount.branchName ?? "",
            branchCode: bankAccount.branchCode ?? "",
          }
        : EMPTY_BANK_FORM,
    );
    setBankError(null);
    setIsEditingBank(true);
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankError(null);

    if (
      !bankForm.accountHolderName.trim() ||
      !bankForm.accountNumber.trim() ||
      !bankForm.bankName.trim()
    ) {
      setBankError(t("bank.errorRequired"));
      return;
    }

    setIsSavingBank(true);
    try {
      const saved = await ownerService.upsertBankAccount({
        accountHolderName: bankForm.accountHolderName.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        bankName: bankForm.bankName.trim(),
        bankCode: bankForm.bankCode.trim() || undefined,
        branchName: bankForm.branchName.trim() || undefined,
        branchCode: bankForm.branchCode.trim() || undefined,
      });
      setBankAccount(saved);
      setIsEditingBank(false);
    } catch (err) {
      setBankError(
        err instanceof ApiError ? err.message : t("bank.errorSave"),
      );
    } finally {
      setIsSavingBank(false);
    }
  };

  const statusFilterOptions: Array<{ value: PaymentStatus | ""; label: string }> =
    [
      { value: "", label: t("transactions.filterAll") },
      { value: "COMPLETED", label: t("status.COMPLETED") },
      { value: "PROCESSING", label: t("status.PROCESSING") },
      { value: "PENDING", label: t("status.PENDING") },
      { value: "FAILED", label: t("status.FAILED") },
      { value: "REFUNDED", label: t("status.REFUNDED") },
    ];

  if (guardLoading || !isAuthorized || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-3 inline-flex items-center gap-2 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("backToDashboard")}
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-error bg-[var(--color-error-bg)] p-4">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-error-foreground"
                aria-hidden="true"
              />
              <p className="flex-1 text-sm text-error-foreground">{error}</p>
              <button
                onClick={loadCoreData}
                className="shrink-0 rounded-md border border-error px-3 py-1.5 text-sm font-medium text-error-foreground transition-colors hover:bg-[var(--color-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("error.tryAgain")}
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* Balance summary cards */}
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-primary/30 bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {t("summary.pendingBalance")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                        {formatAmount(summary?.pendingBalance ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        {t("summary.pendingBalanceDesc")}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-primary/10 p-2.5">
                      <Wallet
                        className="h-5 w-5 text-primary"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {t("summary.thisMonth")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                        {formatAmount(summary?.thisMonthEarnings ?? 0)}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-primary/10 p-2.5">
                      <CalendarRange
                        className="h-5 w-5 text-primary"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {t("summary.thisYear")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                        {formatAmount(summary?.thisYearEarnings ?? 0)}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-primary/10 p-2.5">
                      <TrendingUp
                        className="h-5 w-5 text-primary"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {t("summary.lifetime")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                        {formatAmount(summary?.lifetimeEarnings ?? 0)}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-primary/10 p-2.5">
                      <CircleDollarSign
                        className="h-5 w-5 text-primary"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Transaction history */}
                <section className="lg:col-span-2">
                  <div className="rounded-lg border border-border bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Receipt
                          className="h-5 w-5 text-primary"
                          aria-hidden="true"
                        />
                        <h2 className="text-base font-semibold text-foreground">
                          {t("transactions.title")}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="tx-status-filter"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          {t("transactions.filterLabel")}
                        </label>
                        <select
                          id="tx-status-filter"
                          value={txStatusFilter}
                          onChange={(e) => {
                            setTxStatusFilter(
                              e.target.value as PaymentStatus | "",
                            );
                            setTxPage(1);
                          }}
                          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {statusFilterOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isTxLoading ? (
                      <div className="flex h-64 items-center justify-center">
                        <LoadingSpinner size="md" />
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                          <Receipt
                            className="h-8 w-8 text-[var(--color-text-tertiary)]"
                            aria-hidden="true"
                          />
                        </div>
                        <h3 className="mb-2 font-semibold text-foreground">
                          {t("transactions.emptyTitle")}
                        </h3>
                        <p className="max-w-sm text-sm text-muted-foreground">
                          {t("transactions.emptyDesc")}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted">
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                                  {t("transactions.date")}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                                  {t("transactions.bookingRef")}
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                                  {t("transactions.amount")}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                                  {t("transactions.status")}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {transactions.map((tx) => (
                                <tr
                                  key={tx.id}
                                  className="transition-colors hover:bg-muted"
                                >
                                  <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                                    {new Date(tx.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-4">
                                    <Link
                                      href={`/${locale}/owner/bookings/${tx.bookingId}`}
                                      className="font-medium text-primary transition-colors hover:text-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      {tx.bookingRef}
                                    </Link>
                                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">
                                      {tx.route}
                                    </p>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-foreground">
                                    {tx.currency} {tx.amount.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-4">
                                    <span
                                      className={`inline-flex rounded-sm px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusClasses(tx.status)}`}
                                    >
                                      {t(`status.${tx.status}`)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {txTotalPages > 1 && (
                          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
                            <p className="text-xs text-muted-foreground">
                              {t("transactions.pageOf", {
                                page: txPage,
                                totalPages: txTotalPages,
                              })}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  setTxPage((p) => Math.max(1, p - 1))
                                }
                                disabled={txPage <= 1}
                                aria-label={t("transactions.prev")}
                                className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <ChevronLeft
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </button>
                              <button
                                onClick={() =>
                                  setTxPage((p) =>
                                    Math.min(txTotalPages, p + 1),
                                  )
                                }
                                disabled={txPage >= txTotalPages}
                                aria-label={t("transactions.next")}
                                className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <ChevronRight
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>

                {/* Bank account */}
                <section>
                  <div className="rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                      <Landmark
                        className="h-5 w-5 text-primary"
                        aria-hidden="true"
                      />
                      <h2 className="text-base font-semibold text-foreground">
                        {t("bank.title")}
                      </h2>
                    </div>

                    <div className="p-6">
                      {isEditingBank ? (
                        <form onSubmit={handleBankSubmit} className="space-y-4">
                          {bankError && (
                            <div className="flex items-start gap-2 rounded-md border border-error bg-[var(--color-error-bg)] p-3">
                              <AlertCircle
                                className="mt-0.5 h-4 w-4 shrink-0 text-error-foreground"
                                aria-hidden="true"
                              />
                              <p className="text-xs text-error-foreground">
                                {bankError}
                              </p>
                            </div>
                          )}

                          <div>
                            <label
                              htmlFor="accountHolderName"
                              className="mb-1 block text-xs font-medium text-foreground"
                            >
                              {t("bank.accountHolder")}
                            </label>
                            <input
                              id="accountHolderName"
                              type="text"
                              value={bankForm.accountHolderName}
                              onChange={(e) =>
                                setBankForm((f) => ({
                                  ...f,
                                  accountHolderName: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="accountNumber"
                              className="mb-1 block text-xs font-medium text-foreground"
                            >
                              {t("bank.accountNumber")}
                            </label>
                            <input
                              id="accountNumber"
                              type="text"
                              inputMode="numeric"
                              value={bankForm.accountNumber}
                              onChange={(e) =>
                                setBankForm((f) => ({
                                  ...f,
                                  accountNumber: e.target.value,
                                }))
                              }
                              placeholder={
                                bankAccount?.accountNumberMasked ?? ""
                              }
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                              {t("bank.accountNumberHint")}
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor="bankName"
                              className="mb-1 block text-xs font-medium text-foreground"
                            >
                              {t("bank.bankName")}
                            </label>
                            <input
                              id="bankName"
                              type="text"
                              value={bankForm.bankName}
                              onChange={(e) =>
                                setBankForm((f) => ({
                                  ...f,
                                  bankName: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label
                                htmlFor="bankCode"
                                className="mb-1 block text-xs font-medium text-foreground"
                              >
                                {t("bank.bankCode")}
                              </label>
                              <input
                                id="bankCode"
                                type="text"
                                value={bankForm.bankCode}
                                onChange={(e) =>
                                  setBankForm((f) => ({
                                    ...f,
                                    bankCode: e.target.value,
                                  }))
                                }
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="branchCode"
                                className="mb-1 block text-xs font-medium text-foreground"
                              >
                                {t("bank.branchCode")}
                              </label>
                              <input
                                id="branchCode"
                                type="text"
                                value={bankForm.branchCode}
                                onChange={(e) =>
                                  setBankForm((f) => ({
                                    ...f,
                                    branchCode: e.target.value,
                                  }))
                                }
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="branchName"
                              className="mb-1 block text-xs font-medium text-foreground"
                            >
                              {t("bank.branchName")}
                            </label>
                            <input
                              id="branchName"
                              type="text"
                              value={bankForm.branchName}
                              onChange={(e) =>
                                setBankForm((f) => ({
                                  ...f,
                                  branchName: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="submit"
                              disabled={isSavingBank}
                              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {isSavingBank ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <>
                                  <Check
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  {t("bank.save")}
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingBank(false)}
                              disabled={isSavingBank}
                              className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                              {t("bank.cancel")}
                            </button>
                          </div>
                        </form>
                      ) : bankAccount ? (
                        <div className="space-y-4">
                          <dl className="space-y-3">
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                {t("bank.accountHolder")}
                              </dt>
                              <dd className="mt-0.5 font-medium text-foreground">
                                {bankAccount.accountHolderName}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                {t("bank.accountNumber")}
                              </dt>
                              <dd className="mt-0.5 font-mono font-medium text-foreground">
                                {bankAccount.accountNumberMasked ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                {t("bank.bankName")}
                              </dt>
                              <dd className="mt-0.5 font-medium text-foreground">
                                {bankAccount.bankName}
                                {bankAccount.bankCode
                                  ? ` (${bankAccount.bankCode})`
                                  : ""}
                              </dd>
                            </div>
                            {(bankAccount.branchName ||
                              bankAccount.branchCode) && (
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  {t("bank.branchName")}
                                </dt>
                                <dd className="mt-0.5 font-medium text-foreground">
                                  {bankAccount.branchName ?? "—"}
                                  {bankAccount.branchCode
                                    ? ` (${bankAccount.branchCode})`
                                    : ""}
                                </dd>
                              </div>
                            )}
                          </dl>
                          <button
                            onClick={openBankEditor}
                            className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            {t("bank.edit")}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                            <Landmark
                              className="h-7 w-7 text-[var(--color-text-tertiary)]"
                              aria-hidden="true"
                            />
                          </div>
                          <h3 className="mb-1 font-semibold text-foreground">
                            {t("bank.emptyTitle")}
                          </h3>
                          <p className="mb-4 text-sm text-muted-foreground">
                            {t("bank.emptyDesc")}
                          </p>
                          <button
                            onClick={openBankEditor}
                            className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Landmark className="h-4 w-4" aria-hidden="true" />
                            {t("bank.addAccount")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* Settlement history */}
              <section className="mt-6">
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                    <Wallet
                      className="h-5 w-5 text-primary"
                      aria-hidden="true"
                    />
                    <h2 className="text-base font-semibold text-foreground">
                      {t("settlements.title")}
                    </h2>
                  </div>

                  {settlements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <Wallet
                          className="h-8 w-8 text-[var(--color-text-tertiary)]"
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="mb-2 font-semibold text-foreground">
                        {t("settlements.emptyTitle")}
                      </h3>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        {t("settlements.emptyDesc")}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted">
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                              {t("settlements.period")}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                              {t("settlements.bookings")}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                              {t("settlements.gross")}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                              {t("settlements.commission")}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                              {t("settlements.net")}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                              {t("settlements.status")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {settlements.map((s) => (
                            <tr
                              key={s.id}
                              className="transition-colors hover:bg-muted"
                            >
                              <td className="px-6 py-4">
                                <span className="font-medium text-foreground">
                                  {s.period}
                                </span>
                                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                                  {s.settlementCode}
                                </p>
                              </td>
                              <td className="px-4 py-4 text-right text-muted-foreground">
                                {s.totalBookings}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-right text-muted-foreground">
                                {formatAmount(s.grossAmount)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-right text-muted-foreground">
                                − {formatAmount(s.commissionAmount)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-foreground">
                                {formatAmount(s.netAmount)}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-sm px-2.5 py-0.5 text-xs font-medium ${getSettlementStatusClasses(s.status)}`}
                                >
                                  {t(`status.${s.status}`)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
