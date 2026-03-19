"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FaFacebookF,
  FaTwitter,
  FaInstagram,
  FaLinkedinIn,
} from "react-icons/fa";

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("navigation");
  const params = useParams();
  const locale = params.locale as string;

  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { name: tNav("home"), href: `/${locale}` },
    { name: tNav("search"), href: `/${locale}/search` },
    { name: tNav("howItWorks"), href: `/${locale}/how-it-works` },
    { name: tNav("about"), href: `/${locale}/about` },
  ];

  const supportLinks = [
    { name: tNav("contact"), href: `/${locale}/contact` },
    { name: t("faq"), href: `/${locale}/faq` },
  ];

  const legalLinks = [
    { name: t("privacyPolicy"), href: `/${locale}/privacy` },
    { name: t("termsOfService"), href: `/${locale}/terms` },
    { name: t("refundPolicy"), href: `/${locale}/refund-policy` },
  ];

  const socialLinks = [
    { name: t("social.facebook"), icon: FaFacebookF, href: "#" },
    { name: t("social.twitter"), icon: FaTwitter, href: "#" },
    { name: t("social.instagram"), icon: FaInstagram, href: "#" },
    { name: t("social.linkedin"), icon: FaLinkedinIn, href: "#" },
  ];

  return (
    <footer className="border-t border-white/10 bg-foreground py-16 text-white">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-3">
          {/* Brand Section */}
          <div>
            <Link href={`/${locale}`} className="flex items-center space-x-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <span className="text-xl font-bold text-white">TN</span>
              </div>
              <span className="text-xl font-bold">TravelNest</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-text-tertiary">
              {t("description")}
            </p>
            <div className="mt-6 flex space-x-4">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-text-tertiary transition-colors hover:text-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sr-only">{item.name}</span>
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-5 text-[16px] font-semibold text-white">
              {t("quickLinks")}
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-text-tertiary transition-colors hover:text-primary"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Get in touch */}
          <div>
            <h3 className="mb-5 text-[16px] font-semibold text-white">
              {t("support")}
            </h3>
            <ul className="space-y-3">
              {supportLinks.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-text-tertiary transition-colors hover:text-primary"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
              {legalLinks.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-text-tertiary transition-colors hover:text-primary"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-center text-sm text-text-tertiary md:text-left">
            {t("copyright", { year: currentYear })}
          </p>
          <div className="flex gap-6">
            <Link
              href={`/${locale}/privacy`}
              className="text-sm text-text-tertiary transition-colors hover:text-primary"
            >
              {t("privacyPolicy")}
            </Link>
            <Link
              href={`/${locale}/terms`}
              className="text-sm text-text-tertiary transition-colors hover:text-primary"
            >
              {t("termsOfService")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
