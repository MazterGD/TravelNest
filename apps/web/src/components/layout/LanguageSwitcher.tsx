"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Globe } from 'lucide-react';
import { LOCALE_LABELS } from "@/constants";

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const currentLocale = (params.locale as string) || "en";
  const locales = ["en", "si", "ta"] as const;

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === currentLocale) {
      setIsOpen(false);
      return;
    }

    startTransition(() => {
      // Replace the locale in the pathname
      const newPathname = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
      router.push(newPathname);
      setIsOpen(false);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">
          {LOCALE_LABELS[currentLocale as keyof typeof LOCALE_LABELS]}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 z-50 mt-2 w-40 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="py-1">
              {locales.map((locale) => (
                <button
                  key={locale}
                  onClick={() => handleLocaleChange(locale)}
                  className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
                    locale === currentLocale
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                  disabled={isPending}
                >
                  {LOCALE_LABELS[locale]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
