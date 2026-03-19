import { useLocale } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
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

  const searchHref = `/${locale}/search`;
  const howItWorksHref = `/${locale}/how-it-works`;
  const contactHref = `/${locale}/contact`;
  const faqHref = `/${locale}/faq`;
  const ownerRegisterHref = `/${locale}/register/owner`;

  return (
    <MainLayout>
      <SearchSection searchHref={searchHref} howItWorksHref={howItWorksHref} />
      <TrustIndicators />
      <PopularPackages searchHref={searchHref} />
      <PopularRoutes searchHref={searchHref} />
      <FeaturedVehicles searchHref={searchHref} />
      <HowItWorks searchHref={searchHref} />
      <Testimonials />
      <FAQ contactHref={contactHref} helpCenterHref={faqHref} />
      <OwnerCTA ownerRegisterHref={ownerRegisterHref} />
    </MainLayout>
  );
}
