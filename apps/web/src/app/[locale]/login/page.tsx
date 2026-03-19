"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  FaGoogle,
  FaFacebook,
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaLock,
  FaBus,
  FaUsers,
  FaStar,
} from "react-icons/fa";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { authService, ApiError } from "@/lib/api";
import { getDashboardUrl } from "@/lib/utils/getDashboardUrl";
import { useAuthStore } from "@/store";
import { useGuestGuard } from "@/hooks";
import { cn } from "@/lib/utils/cn";

type LoginMethod = "password" | "otp";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { login } = useAuthStore();

  // Redirect authenticated users to their dashboard
  const { isLoading: guardLoading, isAuthorized } = useGuestGuard();

  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    emailOrPhone: "",
    password: "",
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOAuthLogin = (provider: "google" | "facebook") => {
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
    const returnTo = `${window.location.origin}/${locale}/auth/callback`;
    const authUrl = new URL(`${apiBaseUrl}/auth/oauth/${provider}`);
    authUrl.searchParams.set("returnTo", returnTo);
    window.location.href = authUrl.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email: formData.emailOrPhone,
        password: formData.password,
      });

      // Store user and token in auth store
      login(response.user, response.accessToken);

      // Redirect to role-specific dashboard
      router.push(getDashboardUrl(response.user, locale));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("errors.unexpected"));
      }
    } finally {
      setIsLoading(false);
    }
  };

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
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Image/Illustration */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-3xl shadow-2xl p-12 border-2 border-gray-100">
              <div className="mb-8">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  {t("marketing.title")}
                </h2>
                <p className="text-xl text-gray-600 leading-relaxed">
                  {t("marketing.subtitle")}
                </p>
              </div>
              <div className="relative h-96 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10">
                <Image
                  src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800"
                  alt="Bus travel in Sri Lanka"
                  fill
                  className="object-cover"
                  priority
                  unoptimized
                />
              </div>
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                  <div className="flex justify-center mb-2">
                    <FaBus className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary mb-1">
                    500+
                  </div>
                  <div className="text-sm text-gray-600">
                    {t("marketing.stats.buses")}
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                  <div className="flex justify-center mb-2">
                    <FaUsers className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary mb-1">
                    5000+
                  </div>
                  <div className="text-sm text-gray-600">
                    {t("marketing.stats.customers")}
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                  <div className="flex justify-center mb-2">
                    <FaStar className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary mb-1">
                    4.8★
                  </div>
                  <div className="text-sm text-gray-600">
                    {t("marketing.stats.rating")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border-2 border-gray-100">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t("title")}
              </h1>
              <p className="text-lg text-gray-600">{t("subtitle")}</p>
            </div>

            {/* Login Method Toggle */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl mb-8">
              <button
                type="button"
                onClick={() => setLoginMethod("password")}
                className={cn(
                  "flex-1 py-3 rounded-lg font-semibold transition-all",
                  loginMethod === "password"
                    ? "bg-white text-primary shadow-md"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                {t("passwordLogin")}
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod("otp")}
                className={cn(
                  "flex-1 py-3 rounded-lg font-semibold transition-all",
                  loginMethod === "otp"
                    ? "bg-white text-primary shadow-md"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                {t("otpLogin")}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Email or Phone Input */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-2">
                  {t("emailOrPhone")}
                </label>
                <div className="relative group">
                  <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    required
                    value={formData.emailOrPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, emailOrPhone: e.target.value })
                    }
                    placeholder={t("emailOrPhonePlaceholder")}
                    className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Password Input (only for password login) */}
              {loginMethod === "password" && (
                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-2">
                    {t("password")}
                  </label>
                  <div className="relative group">
                    <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      placeholder={t("passwordPlaceholder")}
                      className="w-full pl-12 pr-12 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                    >
                      {showPassword ? (
                        <FaEyeSlash className="w-5 h-5" />
                      ) : (
                        <FaEye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              {loginMethod === "password" && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.rememberMe}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rememberMe: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-gray-700 group-hover:text-gray-900">
                      {t("rememberMe")}
                    </span>
                  </label>
                  <Link
                    href={`/${locale}/forgot-password`}
                    className="text-primary hover:text-primary/80 font-semibold transition-colors"
                  >
                    {t("forgotPassword")}
                  </Link>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-primary to-primary/90 text-white py-5 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" className="text-white" />
                ) : loginMethod === "password" ? (
                  t("submit")
                ) : (
                  t("sendOtp")
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 text-lg">
                  {t("divider")}
                </span>
              </div>
            </div>

            {/* Social Login */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                type="button"
                onClick={() => handleOAuthLogin("google")}
                className="flex items-center justify-center gap-3 py-4 border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <FaGoogle className="w-5 h-5 text-red-500" />
                <span className="font-semibold text-gray-700">
                  {t("social.google")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleOAuthLogin("facebook")}
                className="flex items-center justify-center gap-3 py-4 border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <FaFacebook className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-700">
                  {t("social.facebook")}
                </span>
              </button>
            </div>

            {/* Register Links */}
            <div className="text-center space-y-3">
              <p className="text-gray-600">{t("noAccount")}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/${locale}/register/customer`}
                  className="px-6 py-3 border-2 border-primary text-primary rounded-xl hover:bg-primary hover:text-white transition-all font-semibold"
                >
                  {t("registerCustomer")}
                </Link>
                <Link
                  href={`/${locale}/register/owner`}
                  className="px-6 py-3 border-2 border-primary text-primary rounded-xl hover:bg-primary hover:text-white transition-all font-semibold"
                >
                  {t("registerOwner")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
