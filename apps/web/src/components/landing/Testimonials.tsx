import { Star, Quote } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { ImageWithFallback } from "@/components/landing/ImageWithFallback";
import type { LandingTestimonial } from "@/lib/api/services";

interface TestimonialsProps {
  testimonials: LandingTestimonial[];
  trustedPartners: Array<{ id: string; name: string; logoUrl?: string | null }>;
}

export function Testimonials({
  testimonials,
  trustedPartners,
}: TestimonialsProps) {
  const t = useTranslations("landing.testimonials");
  const messages = useMessages() as {
    landing?: {
      testimonials?: {
        items?: Array<{
          name?: string;
          role?: string;
          organization?: string;
          quote?: string;
          tripDetails?: string;
        }>;
        trustedBy?: string[];
      };
    };
  };

  const localizedItems = Array.isArray(messages?.landing?.testimonials?.items)
    ? messages.landing.testimonials.items
    : [];
  const localizedTrustedBy = Array.isArray(
    messages?.landing?.testimonials?.trustedBy,
  )
    ? messages.landing.testimonials.trustedBy
    : [];
  const trustedPartnerNames = trustedPartners.map(
    (company, index) => localizedTrustedBy[index] || company.name,
  );

  return (
    <section className="bg-muted py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-3 text-[28px] font-bold leading-[36px] tracking-[-0.01em] text-foreground sm:text-[36px] sm:leading-[44px]">
            {t("title")}
          </h2>
          <p className="mx-auto max-w-lg text-[16px] leading-[24px] text-muted-foreground sm:text-[18px] sm:leading-[28px]">
            {t("subtitle")}
          </p>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, index) => {
            const localizedItem = localizedItems[index];
            const displayName = localizedItem?.name || testimonial.name;
            const displayRole = localizedItem?.role || testimonial.role;
            const displayOrganization =
              localizedItem?.organization || testimonial.organization;
            const displayQuote = localizedItem?.quote || testimonial.quote;
            const displayTripDetails =
              localizedItem?.tripDetails || testimonial.tripDetails;

            return (
              <div
                key={testimonial.id}
                className="relative overflow-hidden rounded-[20px] border border-border bg-white p-8 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="absolute right-6 top-6">
                  <Quote className="h-12 w-12 fill-border text-border" />
                </div>

                <div className="relative z-10 mb-4 flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-[18px] w-[18px] fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                <p className="relative z-10 mb-5 text-[16px] leading-[24px] text-foreground">
                  &ldquo;{displayQuote}&rdquo;
                </p>

                <div className="relative z-10 mb-6 border-b border-border pb-6">
                  <p className="text-[14px] text-text-tertiary">
                    {displayTripDetails}
                  </p>
                </div>

                <div className="relative z-10 flex items-center gap-4">
                  <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
                    <ImageWithFallback
                      src={testimonial.imageUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-foreground">
                      {displayName}
                    </div>
                    <div className="text-[13px] text-muted-foreground">
                      {displayRole}
                    </div>
                    <div className="text-[13px] text-text-tertiary">
                      {displayOrganization}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-12">
          <div className="mb-8 text-center">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              {t("trustedByTitle")}
            </h3>
            <p className="text-muted-foreground">{t("trustedBySubtitle")}</p>
          </div>

          <div className="relative overflow-hidden">
            <div className="animate-scroll-left flex gap-6">
              {trustedPartnerNames.map((companyName, index) => (
                <div
                  key={`first-${trustedPartners[index]?.id || index}`}
                  className="flex-shrink-0 whitespace-nowrap rounded-xl border border-border bg-white px-5 py-2.5 text-[14px] font-medium text-muted-foreground"
                >
                  {companyName}
                </div>
              ))}
              {trustedPartnerNames.map((companyName, index) => (
                <div
                  key={`second-${trustedPartners[index]?.id || index}`}
                  className="flex-shrink-0 whitespace-nowrap rounded-xl border border-border bg-white px-5 py-2.5 text-[14px] font-medium text-muted-foreground"
                >
                  {companyName}
                </div>
              ))}
            </div>
            <style>{`
              @keyframes scroll-left {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .animate-scroll-left { animation: scroll-left 25s linear infinite; }
              @media (prefers-reduced-motion: reduce) {
                .animate-scroll-left { animation: none; }
              }
              .animate-scroll-left:hover { animation-play-state: paused; }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  );
}
