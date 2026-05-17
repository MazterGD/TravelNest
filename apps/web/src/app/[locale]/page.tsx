"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  landingContentService,
  type LandingDataResponse,
  ApiError,
} from "@/lib/api";
import {
  FAQ,
  FeaturedVehicles,
  HowItWorks,
  OwnerCTA,
  PopularRoutes,
  PopularPackages,
  SearchSection,
  Testimonials,
  TrustIndicators,
} from "@/components/landing";

export default function Home() {
  const locale = useLocale();
  const [landingData, setLandingData] = useState<LandingDataResponse | null>(
    null,
  );

  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const response = await landingContentService.getLandingData();
        setLandingData(response);
      } catch (error) {
        if (error instanceof ApiError) {
          console.error("Failed to fetch landing data:", error.message);
          return;
        }
        console.error("Failed to fetch landing data:", error);
      }
    };

    fetchLandingData();
  }, []);

  const searchHref = `/${locale}/search`;
  const packagesHref = `/${locale}/packages`;
  const howItWorksHref = `/${locale}/how-it-works`;
  const contactHref = `/${locale}/contact`;
  const faqHref = `/${locale}/faq`;
  const ownerRegisterHref = `/${locale}/register/owner`;

  return (
    <MainLayout>
      <SearchSection searchHref={searchHref} howItWorksHref={howItWorksHref} />
      <TrustIndicators stats={landingData?.stats || []} />
      <PopularPackages packagesHref={packagesHref} />
      <PopularRoutes
        searchHref={searchHref}
        routes={landingData?.popularRoutes || []}
      />
      <FeaturedVehicles
        searchHref={searchHref}
        vehicles={landingData?.featuredVehicles || []}
      />
      <HowItWorks searchHref={searchHref} />
      <Testimonials
        testimonials={landingData?.testimonials || []}
        trustedPartners={landingData?.trustedPartners || []}
      />
      <FAQ contactHref={contactHref} helpCenterHref={faqHref} />
      <OwnerCTA ownerRegisterHref={ownerRegisterHref} />
    </MainLayout>
  );
}
