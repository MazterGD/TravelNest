"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Chrome, Facebook, Eye, EyeOff, Mail, Lock, Bus, Users, Star } from 'lucide-react';
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { authService, landingContentService, ApiError } from "@/lib/api";
import { getDashboardUrl } from "@/lib/utils/getDashboardUrl";
import { useAuthStore } from "@/store";
import { useGuestGuard } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import { MARKETING_STATS, OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "@/constants";

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
  const [submitCooldown, setSubmitCooldown] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDestination, setOtpDestination] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  const SUBMIT_COOLDOWN_SECONDS = 30;
  const [marketingStats, setMarketingStats] = useState<{
    verifiedBuses: string;
    happyCustomers: string;
    averageRating: string;
  }>({
    verifiedBuses: MARKETING_STATS.verifiedBuses,
    happyCustomers: MARKETING_STATS.happyCustomers,
    averageRating: MARKETING_STATS.averageRating,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await landingContentService.getPublicConfig();
        if (config.loginMarketingStats) {
          setMarketingStats({
            verifiedBuses:
              config.loginMarketingStats.verifiedBuses ||
              MARKETING_STATS.verifiedBuses,
            happyCustomers:
              config.loginMarketingStats.happyCustomers ||
              MARKETING_STATS.happyCustomers,
            averageRating:
              config.loginMarketingStats.averageRating ||
              MARKETING_STATS.averageRating,
          });
        }
      } catch (err) {
        console.error("Failed to load login marketing stats", err);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (otpCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setOtpCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpCooldown]);

  useEffect(() => {
    if (submitCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSubmitCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [submitCooldown]);

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
    if (submitCooldown > 0) {
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      if (loginMethod === "otp") {
        if (!otpSent) {
          const sendOtpResult = await authService.sendOtp({
            identifier: formData.emailOrPhone.trim(),
            purpose: "LOGIN",
          });

          setOtpSent(true);
          setOtpDestination(sendOtpResult.destination);
          setOtpCooldown(OTP_RESEND_COOLDOWN_SECONDS);
          setIsLoading(false);
          return;
        }

        const verificationResult = await authService.verifyOtp({
          identifier: formData.emailOrPhone.trim(),
          code: otpCode.trim(),
          purpose: "LOGIN",
        });

        if (!verificationResult.user || !verificationResult.accessToken) {
          throw new ApiError(401, "Unable to complete OTP login");
        }

        login(verificationResult.user, verificationResult.accessToken);
        router.push(getDashboardUrl(verificationResult.user, locale));
        return;
      }

      const response = await authService.login({
        email: formData.emailOrPhone,
        password: formData.password,
      });

      // Store user and token in auth store
      login(response.user, response.accessToken);

      // Redirect to role-specific dashboard
      router.push(getDashboardUrl(response.user, locale));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("errors.rateLimited"));
        setSubmitCooldown(SUBMIT_COOLDOWN_SECONDS);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("errors.unexpected"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0 || !formData.emailOrPhone.trim()) {
      return;
    }

    try {
      setIsLoading(true);
      const sendOtpResult = await authService.sendOtp({
        identifier: formData.emailOrPhone.trim(),
        purpose: "LOGIN",
      });
      setOtpDestination(sendOtpResult.destination);
      setOtpCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("errors.rateLimited"));
        setOtpCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to resend OTP. Please try again.");
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
        <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-6 items-center">
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
                    <Bus className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary mb-1">
                    {marketingStats.verifiedBuses}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t("marketing.stats.buses")}
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                  <div className="flex justify-center mb-2">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary mb-1">
                    {marketingStats.happyCustomers}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t("marketing.stats.customers")}
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                  <div className="flex justify-center mb-2">
                    <Star className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary mb-1">
                    {marketingStats.averageRating}
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
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg mb-8">
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
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={formData.emailOrPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, emailOrPhone: e.target.value })
                    }
                    placeholder={t("emailOrPhonePlaceholder")}
                    className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              {loginMethod === "otp" && otpSent && (
                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-2">
                    OTP Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={OTP_LENGTH}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                    required
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Code sent to {otpDestination || formData.emailOrPhone}
                  </p>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpCooldown > 0 || isLoading}
                    className="mt-2 text-sm font-semibold text-primary disabled:text-gray-400"
                  >
                    {otpCooldown > 0
                      ? `Resend OTP in ${otpCooldown}s`
                      : "Resend OTP"}
                  </button>
                </div>
              )}

              {/* Password Input (only for password login) */}
              {loginMethod === "password" && (
                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-2">
                    {t("password")}
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
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
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
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
                disabled={isLoading || submitCooldown > 0}
                className="w-full bg-gradient-to-r from-primary to-primary/90 text-white py-5 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" className="text-white" />
                ) : submitCooldown > 0 ? (
                  t("errors.cooldown", { seconds: submitCooldown })
                ) : loginMethod === "password" ? (
                  t("submit")
                ) : otpSent ? (
                  "Verify OTP"
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
                <Chrome className="w-5 h-5 text-red-500" />
                <span className="font-semibold text-gray-700">
                  {t("social.google")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleOAuthLogin("facebook")}
                className="flex items-center justify-center gap-3 py-4 border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <Facebook className="w-5 h-5 text-blue-600" />
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
