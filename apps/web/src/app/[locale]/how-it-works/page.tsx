import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  Search,
  FileText,
  Scale,
  CheckCircle,
  CreditCard,
  UserPlus,
  Shield,
  Bus,
  Mail,
  TrendingUp,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card, Button } from "@/components/ui";

export default function HowItWorksPage() {
  const t = useTranslations("howItWorks");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const customerSteps = [
    {
      icon: Search,
      title: t("customer.steps.search.title", {
        defaultValue: "Search & Browse",
      }),
      description: t("customer.steps.search.description", {
        defaultValue:
          "Enter your route, date, and passenger count to discover available buses.",
      }),
    },
    {
      icon: FileText,
      title: t("customer.steps.request.title", {
        defaultValue: "Request Quotations",
      }),
      description: t("customer.steps.request.description", {
        defaultValue:
          "Send a quote request with your trip requirements to multiple owners.",
      }),
    },
    {
      icon: Scale,
      title: t("customer.steps.compare.title", {
        defaultValue: "Compare Options",
      }),
      description: t("customer.steps.compare.description", {
        defaultValue:
          "Review pricing, bus details, owner ratings, and included services.",
      }),
    },
    {
      icon: CheckCircle,
      title: t("customer.steps.book.title", {
        defaultValue: "Book Confidently",
      }),
      description: t("customer.steps.book.description", {
        defaultValue:
          "Choose the best quote and confirm your booking instantly.",
      }),
    },
    {
      icon: CreditCard,
      title: t("customer.steps.pay.title", {
        defaultValue: "Pay Securely",
      }),
      description: t("customer.steps.pay.description", {
        defaultValue:
          "Complete payment through a secure checkout and receive confirmation.",
      }),
    },
    {
      icon: Bus,
      title: t("customer.steps.travel.title", {
        defaultValue: "Travel with Peace of Mind",
      }),
      description: t("customer.steps.travel.description", {
        defaultValue:
          "Track your booking and enjoy your journey with verified operators.",
      }),
    },
  ];

  const ownerSteps = [
    {
      icon: UserPlus,
      title: t("owner.steps.register.title", {
        defaultValue: "Register Your Account",
      }),
      description: t("owner.steps.register.description", {
        defaultValue:
          "Create your owner profile and submit your business information.",
      }),
    },
    {
      icon: Shield,
      title: t("owner.steps.verify.title", {
        defaultValue: "Complete Verification",
      }),
      description: t("owner.steps.verify.description", {
        defaultValue:
          "Upload required documents to get verified for customer trust.",
      }),
    },
    {
      icon: Bus,
      title: t("owner.steps.list.title", {
        defaultValue: "List Your Fleet",
      }),
      description: t("owner.steps.list.description", {
        defaultValue:
          "Add your buses, amenities, pricing, and availability details.",
      }),
    },
    {
      icon: Mail,
      title: t("owner.steps.receiveRequests.title", {
        defaultValue: "Receive Requests",
      }),
      description: t("owner.steps.receiveRequests.description", {
        defaultValue:
          "Get incoming quotation requests that match your fleet and routes.",
      }),
    },
    {
      icon: FileText,
      title: t("owner.steps.sendQuotes.title", {
        defaultValue: "Send Competitive Quotes",
      }),
      description: t("owner.steps.sendQuotes.description", {
        defaultValue:
          "Respond quickly with detailed quotations to convert more bookings.",
      }),
    },
    {
      icon: TrendingUp,
      title: t("owner.steps.manage.title", {
        defaultValue: "Manage & Grow",
      }),
      description: t("owner.steps.manage.description", {
        defaultValue:
          "Track bookings, improve service quality, and grow repeat business.",
      }),
    },
  ];

  return (
    <MainLayout>
      <PageHeader
        title={t("hero.title", { defaultValue: "How TravelNest Works" })}
        subtitle={t("hero.subtitle", {
          defaultValue:
            "Simple steps to book your perfect bus or grow your transport business",
        })}
      />

      {/* Customer Section */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">
              {t("customer.title", { defaultValue: "For Customers" })}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("customer.description", {
                defaultValue: "Book a bus in 6 simple steps",
              })}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {customerSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="relative p-6 text-center bg-card border-border">
                  <div className="relative mx-auto mb-4 h-16 w-16">
                    <div className="absolute inset-0 rounded-2xl bg-primary/10" />
                    <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-primary/20" />
                    <div className="relative flex h-full w-full items-center justify-center">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                  </div>

                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-foreground">
                    {index + 1}
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link href={`/${locale}/search`}>
              <Button size="lg">{tCommon("getStarted")}</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Owner Section */}
      <section className="py-16 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">
              {t("owner.title", { defaultValue: "For Bus Owners" })}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("owner.description", {
                defaultValue: "Grow your business in 6 simple steps",
              })}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ownerSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="relative p-6 text-center border-border">
                  <div className="relative mx-auto mb-4 h-16 w-16">
                    <div className="absolute inset-0 rounded-2xl bg-primary/10" />
                    <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-primary/20" />
                    <div className="relative flex h-full w-full items-center justify-center">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                  </div>

                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-foreground">
                    {index + 1}
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link href={`/${locale}/register`}>
              <Button size="lg" variant="secondary">
                {t("ownerCta", { defaultValue: "Register as Owner" })}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
