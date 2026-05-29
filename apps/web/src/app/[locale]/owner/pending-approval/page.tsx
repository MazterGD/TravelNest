"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  Clock,
  CheckCircle2,
  FileText,
  Phone,
  Mail,
  LogOut,
  Bus,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, Badge, CTAButton } from "@/components/ui";
import { useAuthStore } from "@/store";

type StepState = "complete" | "active" | "upcoming";

export default function PendingApprovalPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const t = useTranslations("ownerPendingApproval");
  const { user, isAuthenticated, logout, isLoading } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/${locale}/login`);
    }
  }, [isAuthenticated, isLoading, locale, router]);

  useEffect(() => {
    if (user && user.isVerified && user.role === "VEHICLE_OWNER") {
      router.push(`/${locale}/owner/dashboard`);
    }
  }, [user, locale, router]);

  useEffect(() => {
    if (user && user.role !== "VEHICLE_OWNER") {
      router.push(`/${locale}/dashboard`);
    }
  }, [user, locale, router]);

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/login`);
  };

  if (isLoading || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  const submittedDate = new Date(user.createdAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timelineSteps: Array<{
    state: StepState;
    title: string;
    desc: string;
  }> = [
    {
      state: "complete",
      title: t("timeline.submittedTitle"),
      desc: t("timeline.submittedDesc"),
    },
    {
      state: "active",
      title: t("timeline.reviewTitle"),
      desc: t("timeline.reviewDesc"),
    },
    {
      state: "upcoming",
      title: t("timeline.approvedTitle"),
      desc: t("timeline.approvedDesc"),
    },
  ];

  const restrictions = [
    t("restrictions.item1"),
    t("restrictions.item2"),
    t("restrictions.item3"),
    t("restrictions.item4"),
    t("restrictions.item5"),
  ];

  const nextSteps = [
    t("nextSteps.step1"),
    t("nextSteps.step2"),
    t("nextSteps.step3"),
    t("nextSteps.step4"),
  ];

  return (
    <MainLayout>
      <div className="bg-bg-surface min-h-screen px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1024px]">
          <article className="overflow-hidden rounded-[20px] border border-border bg-background shadow-sm">
            {/* Hero */}
            <header className="border-b border-border bg-background px-6 py-8 sm:px-8 sm:py-12">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-bg-surface text-primary">
                  {!prefersReducedMotion && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border-2 border-primary"
                      initial={{ opacity: 0.6, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.4 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                    />
                  )}
                  <Clock className="relative h-6 w-6" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
                  {t("title")}
                </h1>
                <p className="mt-3 max-w-[60ch] text-base text-muted-foreground">
                  {t("subtitle")}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <Badge variant="warning" size="md" dot>
                    {t("statusBadge")}
                  </Badge>
                  <Badge variant="info" size="md">
                    <Bus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {t("roleBadge")}
                  </Badge>
                </div>
              </div>
            </header>

            <div className="space-y-6 px-6 py-8 sm:px-8 sm:py-12">
              {/* Verification timeline */}
              <section
                aria-labelledby="timeline-heading"
                className="rounded-xl border border-border bg-bg-surface p-6"
              >
                <h2
                  id="timeline-heading"
                  className="mb-6 flex items-center gap-2 text-lg font-semibold text-foreground"
                >
                  <FileText
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                  {t("timeline.heading")}
                </h2>
                <ol className="space-y-1">
                  {timelineSteps.map((step, index) => {
                    const isLast = index === timelineSteps.length - 1;
                    return (
                      <li key={step.title} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <TimelineIcon state={step.state} />
                          {!isLast && (
                            <span
                              aria-hidden="true"
                              className={`mt-1 mb-1 w-px flex-1 ${
                                step.state === "complete"
                                  ? "bg-success-border"
                                  : "bg-border"
                              }`}
                            />
                          )}
                        </div>
                        <div className={`flex-1 ${isLast ? "" : "pb-6"}`}>
                          <h3
                            className={`text-base font-semibold ${
                              step.state === "upcoming"
                                ? "text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {step.title}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {step.desc}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {/* Estimated review time */}
              <section
                aria-labelledby="estimated-heading"
                className="flex items-center gap-4 rounded-xl border border-border bg-bg-surface p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                  <Clock className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="estimated-heading"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    {t("estimated.heading")}
                  </h2>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {t("estimated.value")}
                  </p>
                </div>
              </section>

              {/* Registration details */}
              <section
                aria-labelledby="details-heading"
                className="rounded-xl border border-border bg-bg-surface p-6"
              >
                <h2
                  id="details-heading"
                  className="mb-4 text-lg font-semibold text-foreground"
                >
                  {t("details.heading")}
                </h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <DetailRow
                    label={t("details.name")}
                    value={`${user.firstName} ${user.lastName}`}
                  />
                  <DetailRow label={t("details.email")} value={user.email} />
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      {t("details.status")}
                    </dt>
                    <dd className="mt-1">
                      <Badge variant="warning" size="sm" dot>
                        {t("statusBadge")}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      {t("details.role")}
                    </dt>
                    <dd className="mt-1">
                      <Badge variant="info" size="sm">
                        <Bus
                          className="mr-1.5 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        {t("roleBadge")}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Account restrictions */}
              <section
                aria-labelledby="restrictions-heading"
                className="rounded-xl border border-error-border bg-error-bg p-6"
              >
                <h2
                  id="restrictions-heading"
                  className="mb-2 flex items-center gap-2 text-lg font-semibold text-error-text"
                >
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  {t("restrictions.heading")}
                </h2>
                <p className="mb-4 text-sm text-error-text">
                  {t("restrictions.intro")}
                </p>
                <ul className="space-y-2">
                  {restrictions.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-error-text"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-error"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* What happens next */}
              <section
                aria-labelledby="next-heading"
                className="rounded-xl border border-border bg-bg-surface p-6"
              >
                <h2
                  id="next-heading"
                  className="mb-4 text-lg font-semibold text-foreground"
                >
                  {t("nextSteps.heading")}
                </h2>
                <ol className="space-y-4">
                  {nextSteps.map((step, index) => (
                    <li key={step} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold text-primary"
                      >
                        {index + 1}
                      </span>
                      <p className="pt-0.5 text-sm text-muted-foreground">
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Support */}
              <section
                aria-labelledby="support-heading"
                className="rounded-xl border border-border bg-bg-surface p-6"
              >
                <h2
                  id="support-heading"
                  className="text-lg font-semibold text-foreground"
                >
                  {t("support.heading")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("support.description")}
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <CTAButton
                    href="mailto:support@travenest.lk"
                    variant="primary"
                    size="md"
                    leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
                  >
                    {t("support.emailSupport")}
                  </CTAButton>
                  <CTAButton
                    href="tel:+94112345678"
                    variant="secondary"
                    size="md"
                    leftIcon={<Phone className="h-4 w-4" aria-hidden="true" />}
                  >
                    {t("support.callSupport")}
                  </CTAButton>
                </div>
              </section>
            </div>

            {/* Footer actions */}
            <footer className="flex flex-col gap-3 border-t border-border bg-bg-surface px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <Link
                href={`/${locale}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-primary transition-colors hover:text-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("footer.backHome")}
              </Link>
              <CTAButton
                variant="secondary"
                size="md"
                onClick={handleLogout}
                leftIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}
                ringOffsetClassName="focus-visible:ring-offset-bg-surface"
              >
                {t("footer.logout")}
              </CTAButton>
            </footer>
          </article>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("footer.submittedOn", { date: submittedDate })}
          </p>
        </div>
      </div>
    </MainLayout>
  );
}

function TimelineIcon({ state }: { state: StepState }) {
  if (state === "complete") {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-bg text-success-text">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Clock className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted-foreground">
      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground break-words">
        {value}
      </dd>
    </div>
  );
}
