"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, Suspense } from "react";
import { Lock, Eye, EyeOff, CheckCircle, ArrowRight } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { authService, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  
  // Get token from URL query params (e.g. ?token=...)
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    
    // Calculate password strength
    let strength = 0;
    if (value.length >= 8) strength += 25;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) strength += 25;
    if (/\d/.test(value)) strength += 25;
    if (/[^a-zA-Z\d]/.test(value)) strength += 25;
    setPasswordStrength(strength);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 50) return "bg-red-500";
    if (passwordStrength < 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 50) return t("auth.register.passwordStrength.weak", { defaultValue: "Weak" });
    if (passwordStrength < 75) return t("auth.register.passwordStrength.medium", { defaultValue: "Medium" });
    return t("auth.register.passwordStrength.strong", { defaultValue: "Strong" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError(t("auth.resetPassword.errors.missingToken", { defaultValue: "Invalid or missing reset token." }));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.resetPassword.errors.passwordMismatch", { defaultValue: "Passwords do not match." }));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.resetPassword(token, password);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("auth.resetPassword.errors.unexpected", { defaultValue: "Failed to reset password. Please try again or request a new link." }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!token && !isSuccess) {
    return (
      <div className="text-center py-8">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 max-w-md mx-auto">
          <h3 className="text-lg font-bold text-red-800 mb-2">
            {t("auth.resetPassword.errors.invalidLink", { defaultValue: "Invalid Reset Link" })}
          </h3>
          <p className="text-red-600 mb-6">
            {t("auth.resetPassword.errors.missingTokenText", { 
              defaultValue: "The password reset link is invalid or has expired. Please request a new one." 
            })}
          </p>
          <Link
            href={`/${locale}/forgot-password`}
            className="inline-block bg-white text-red-700 font-semibold py-3 px-6 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
          >
            {t("auth.forgotPassword.title", { defaultValue: "Request New Link" })}
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {t("auth.resetPassword.successTitle", { defaultValue: "Password Reset Successfully!" })}
        </h3>
        <p className="text-gray-600 mb-8 leading-relaxed">
          {t("auth.resetPassword.successMessage", { 
            defaultValue: "Your password has been changed successfully. You can now login with your new password." 
          })}
        </p>
        <Link
          href={`/${locale}/login`}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors text-lg"
        >
          {t("auth.resetPassword.loginNow", { defaultValue: "Login Now" })}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t("auth.resetPassword.title", { defaultValue: "Set New Password" })}
        </h1>
        <p className="text-gray-600">
          {t("auth.resetPassword.subtitle", { defaultValue: "Your new password must be different from previously used passwords." })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            {t("auth.resetPassword.newPassword", { defaultValue: "New Password" })}
          </label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={handlePasswordChange}
              placeholder={t("auth.resetPassword.newPasswordPlaceholder", { defaultValue: "Enter new password" })}
              className="w-full pl-12 pr-12 py-4 text-base border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {password && (
            <div className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600">
                  {t("auth.register.passwordStrength.label", { defaultValue: "Password strength" })}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    passwordStrength < 50
                      ? "text-red-600"
                      : passwordStrength < 75
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                >
                  {getPasswordStrengthText()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                  style={{ width: `${passwordStrength}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            {t("auth.resetPassword.confirmPassword", { defaultValue: "Confirm New Password" })}
          </label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("auth.resetPassword.confirmPasswordPlaceholder", { defaultValue: "Confirm new password" })}
              className="w-full pl-12 pr-12 py-4 text-base border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !password || !confirmPassword}
          className="w-full bg-gradient-to-r from-primary to-primary/90 text-white py-4 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <LoadingSpinner size="sm" className="text-white" />
          ) : (
            t("auth.resetPassword.submitButton", { defaultValue: "Reset Password" })
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 md:p-10 border-2 border-gray-100">
          <Suspense fallback={
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </MainLayout>
  );
}
