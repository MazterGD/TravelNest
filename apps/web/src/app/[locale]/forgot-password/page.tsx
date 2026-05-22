"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { authService, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError(null);

    try {
      await authService.forgotPassword(email);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("auth.forgotPassword.errors.unexpected", { defaultValue: "An unexpected error occurred. Please try again." }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 md:p-10 border-2 border-gray-100">
          <div className="mb-8">
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-primary transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("auth.forgotPassword.backToLogin", { defaultValue: "Back to Login" })}
            </Link>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t("auth.forgotPassword.title", { defaultValue: "Forgot Password?" })}
            </h1>
            <p className="text-gray-600">
              {t("auth.forgotPassword.subtitle", { defaultValue: "No worries, we'll send you reset instructions." })}
            </p>
          </div>

          {isSuccess ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {t("auth.forgotPassword.successTitle", { defaultValue: "Check your email" })}
              </h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                {t("auth.forgotPassword.successMessage", { 
                  defaultValue: "We sent a password reset link to" 
                })} <br/>
                <span className="font-semibold text-gray-900">{email}</span>
              </p>
              <Link
                href={`/${locale}/login`}
                className="w-full inline-block bg-gray-100 text-gray-700 font-semibold py-4 rounded-xl hover:bg-gray-200 transition-colors"
              >
                {t("auth.forgotPassword.backToLogin", { defaultValue: "Back to Login" })}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  {t("auth.forgotPassword.emailLabel", { defaultValue: "Email address" })}
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.forgotPassword.emailPlaceholder", { defaultValue: "Enter your email" })}
                    className="w-full pl-12 pr-4 py-4 text-base border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-gradient-to-r from-primary to-primary/90 text-white py-4 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" className="text-white" />
                ) : (
                  t("auth.forgotPassword.submitButton", { defaultValue: "Reset Password" })
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
