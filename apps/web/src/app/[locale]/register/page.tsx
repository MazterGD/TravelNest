"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bus, User, CheckCircle, ArrowRight } from 'lucide-react';
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useGuestGuard } from "@/hooks";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const params = useParams();
  const locale = params.locale as string;

  // Redirect authenticated users to their dashboard
  const { isLoading: guardLoading, isAuthorized } = useGuestGuard();

  // Show loading while checking auth state
  if (guardLoading || !isAuthorized) {
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
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {t("title")}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t("intro")}
            </p>
          </div>

          {/* Account Type Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Customer Card */}
            <Link
              href={`/${locale}/register/customer`}
              className="group bg-white rounded-3xl shadow-xl border-2 border-gray-100 hover:border-primary hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="relative h-48 bg-gradient-to-br from-blue-100 to-blue-50">
                <Image
                  src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600"
                  alt="Travel as Customer"
                  fill
                  className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                </div>
              </div>

              <div className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">
                  {t("customer")}
                </h2>
                <p className="text-gray-600 mb-6">
                  {t("customerCard.description")}
                </p>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-3 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{t("customerCard.bullets.0")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{t("customerCard.bullets.1")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{t("customerCard.bullets.2")}</span>
                  </li>
                </ul>

                <div className="flex items-center justify-between">
                  <span className="text-primary font-semibold group-hover:underline">
                    {t("customerCard.cta")}
                  </span>
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                    <ArrowRight className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Owner Card */}
            <Link
              href={`/${locale}/register/owner`}
              className="group bg-white rounded-3xl shadow-xl border-2 border-gray-100 hover:border-primary hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="relative h-48 bg-gradient-to-br from-orange-100 to-orange-50">
                <Image
                  src="https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600"
                  alt="Bus Owner"
                  fill
                  className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                    <Bus className="w-7 h-7 text-primary" />
                  </div>
                </div>
              </div>

              <div className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">
                  {t("owner")}
                </h2>
                <p className="text-gray-600 mb-6">
                  {t("ownerCard.description")}
                </p>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-3 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{t("ownerCard.bullets.0")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{t("ownerCard.bullets.1")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{t("ownerCard.bullets.2")}</span>
                  </li>
                </ul>

                <div className="flex items-center justify-between">
                  <span className="text-primary font-semibold group-hover:underline">
                    {t("ownerCard.cta")}
                  </span>
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                    <ArrowRight className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Already have account */}
          <div className="text-center mt-12">
            <p className="text-gray-600">
              {t("hasAccount")}{" "}
              <Link
                href={`/${locale}/login`}
                className="text-primary font-semibold hover:underline"
              >
                {t("login")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
