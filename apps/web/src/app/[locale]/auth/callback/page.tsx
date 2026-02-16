"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { authService, api } from "@/lib/api";
import { getDashboardUrl } from "@/lib/utils/getDashboardUrl";
import { useAuthStore } from "@/store";

const errorMessages: Record<string, string> = {
  OAUTH_DENIED: "OAuth login was cancelled. Please try again.",
  INVALID_STATE: "OAuth session expired. Please try again.",
  MISSING_CODE: "OAuth response was incomplete. Please try again.",
  PROFILE_ERROR: "Unable to read your social profile. Please try again.",
};

export default function OAuthCallbackPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const { login, setToken } = useAuthStore();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorCode = searchParams.get("error");
    const accessToken = searchParams.get("accessToken");

    if (errorCode) {
      setError(
        errorMessages[errorCode] || "OAuth login failed. Please try again.",
      );
      return;
    }

    if (!accessToken) {
      setError("OAuth login did not return an access token. Please try again.");
      return;
    }

    const finalizeLogin = async () => {
      try {
        setToken(accessToken);
        const response = await authService.me();
        login(response.user, accessToken);
        api.startTokenRefresh();
        router.replace(getDashboardUrl(response.user, locale));
      } catch {
        setToken(null);
        setError("Failed to finalize OAuth login. Please try again.");
      }
    };

    finalizeLogin();
  }, [searchParams, login, setToken, router, locale]);

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          {error ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                OAuth Login Failed
              </h1>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
              >
                Back to Login
              </Link>
            </>
          ) : (
            <>
              <LoadingSpinner size="lg" />
              <p className="text-gray-600 mt-6">
                Finishing your social login...
              </p>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
