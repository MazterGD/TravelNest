"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { landingContentService, ApiError } from "@/lib/api";

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("navigation");
  const params = useParams();
  const locale = params.locale as string;
  const [socialMediaLinks, setSocialMediaLinks] = useState<{
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  }>({});

  useEffect(() => {
    let isMounted = true;

    const fetchPublicConfig = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        if (isMounted) {
          setSocialMediaLinks(response.socialMediaLinks || {});
        }
      } catch (error) {
        if (error instanceof ApiError) {
          console.error("Failed to load footer social links:", error.message);
          return;
        }
        console.error("Failed to load footer social links:", error);
      }
    };

    fetchPublicConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { name: tNav("home"), href: `/${locale}` },
    { name: tNav("search"), href: `/${locale}/search` },
    {
      name: t("tripPackages", { defaultValue: "Trip Packages" }),
      href: `/${locale}/packages`,
    },
    { name: tNav("howItWorks"), href: `/${locale}/how-it-works` },
    { name: tNav("about"), href: `/${locale}/about` },
    { name: tNav("contact"), href: `/${locale}/contact` },
  ];

  const supportLinks = [
    { name: t("faq"), href: `/${locale}/faq` },
    { name: tNav("register"), href: `/${locale}/register/owner` },
    { name: tNav("login"), href: `/${locale}/login` },
  ];

  const legalLinks = [
    { name: t("privacyPolicy"), href: `/${locale}/privacy` },
    { name: t("termsOfService"), href: `/${locale}/terms` },
    { name: t("refundPolicy"), href: `/${locale}/refund-policy` },
  ];

  const socialLinks = [
    {
      name: t("social.facebook"),
      icon: Facebook,
      href: socialMediaLinks.facebook,
    },
    {
      name: t("social.twitter"),
      icon: Twitter,
      href: socialMediaLinks.twitter,
    },
    {
      name: t("social.instagram"),
      icon: Instagram,
      href: socialMediaLinks.instagram,
    },
    {
      name: t("social.linkedin"),
      icon: Linkedin,
      href: socialMediaLinks.linkedin,
    },
  ].filter((item) => Boolean(item.href));

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
            {socialLinks.length > 0 ? (
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
            ) : (
              <p className="mt-6 text-sm text-text-tertiary">
                {t("followUs", { defaultValue: "Follow Us" })}
              </p>
            )}
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
        </div>
      </div>
    </footer>
  );
}
