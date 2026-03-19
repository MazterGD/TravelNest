import { Star, Quote } from "lucide-react";
import { useTranslations } from "next-intl";
import { ImageWithFallback } from "@/components/landing/ImageWithFallback";

export function Testimonials() {
  const t = useTranslations("landing.testimonials");
  const testimonials = [
    {
      name: t("items.0.name"),
      role: t("items.0.role"),
      organization: t("items.0.organization"),
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      rating: 5,
      quote: t("items.0.quote"),
      tripDetails: t("items.0.tripDetails"),
    },
    {
      name: t("items.1.name"),
      role: t("items.1.role"),
      organization: t("items.1.organization"),
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      rating: 5,
      quote: t("items.1.quote"),
      tripDetails: t("items.1.tripDetails"),
    },
    {
      name: t("items.2.name"),
      role: t("items.2.role"),
      organization: t("items.2.organization"),
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      rating: 5,
      quote: t("items.2.quote"),
      tripDetails: t("items.2.tripDetails"),
    },
  ];

  const trustedBy = [
    t("trustedBy.0"),
    t("trustedBy.1"),
    t("trustedBy.2"),
    t("trustedBy.3"),
    t("trustedBy.4"),
    t("trustedBy.5"),
  ];

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
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
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
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              <div className="relative z-10 mb-6 border-b border-border pb-6">
                <p className="text-[14px] text-text-tertiary">
                  {testimonial.tripDetails}
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-4">
                <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
                  <ImageWithFallback
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {testimonial.name}
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    {testimonial.role}
                  </div>
                  <div className="text-[13px] text-text-tertiary">
                    {testimonial.organization}
                  </div>
                </div>
              </div>
            </div>
          ))}
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
              {trustedBy.map((company, index) => (
                <div
                  key={`first-${index}`}
                  className="flex-shrink-0 whitespace-nowrap rounded-xl border border-border bg-white px-5 py-2.5 text-[14px] font-medium text-muted-foreground"
                >
                  {company}
                </div>
              ))}
              {trustedBy.map((company, index) => (
                <div
                  key={`second-${index}`}
                  className="flex-shrink-0 whitespace-nowrap rounded-xl border border-border bg-white px-5 py-2.5 text-[14px] font-medium text-muted-foreground"
                >
                  {company}
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
