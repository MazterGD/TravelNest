"use client";

import { useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { authService, userService, ApiError, api } from "@/lib/api";
import type { User } from "@/types";
import type {
  LoginInput,
  RegisterInput,
  ProfileUpdateInput,
} from "@/lib/validations";

/**
 * Authentication result type
 */
interface AuthResult {
  success: boolean;
  error?: string;
  code?: string;
  validationErrors?: Record<string, string>;
}

/**
 * useAuth hook - handles all authentication operations
 * with proper error handling and state management
 */
export function useAuth() {
  const router = useRouter();
  const initRef = useRef(false);
  const params = useParams();
  const locale = params.locale as string;

  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    login: setLogin,
    logout: setLogout,
    setLoading,
    setUser,
  } = useAuthStore();

  // Check auth status on mount and handle auth errors globally
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initializeAuth = async () => {
      try {
        const storedAuth = localStorage.getItem("travenest-auth");
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          if (parsed?.state?.token) {
            // Validate token with backend
            try {
              const response = await authService.me();
              setLogin(response.user, parsed.state.token);
              // Start automatic token refresh
              api.startTokenRefresh();
            } catch (error) {
              // Token invalid/expired - try refresh
              if (error instanceof ApiError && error.isAuthError()) {
                try {
                  const refreshResponse = await authService.refreshToken();
                  // Re-fetch user with new token
                  setLogin(parsed.state.user, refreshResponse.accessToken);
                  // Start automatic token refresh
                  api.startTokenRefresh();
                } catch {
                  // Refresh failed - clear auth
                  setLogout();
                  localStorage.removeItem("travenest-auth");
                  api.stopTokenRefresh();
                }
              } else {
                setLogout();
                api.stopTokenRefresh();
              }
            }
          }
        }
      } catch {
        setLogout();
        api.stopTokenRefresh();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth errors from API client
    const handleAuthError = () => {
      setLogout();
      localStorage.removeItem("travenest-auth");
      api.stopTokenRefresh();
      router.push(`/${locale}/login?session=expired`);
    };

    window.addEventListener("auth:error", handleAuthError);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("auth:error", handleAuthError);
      api.stopTokenRefresh();
    };
  }, [setLogin, setLogout, setLoading, router]);

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (data: LoginInput): Promise<AuthResult> => {
      setLoading(true);
      try {
        const response = await authService.login(data);
        setLogin(response.user, response.accessToken);
        // Start automatic token refresh
        api.startTokenRefresh();
        return { success: true };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            success: false,
            error: error.message,
            code: error.code,
            validationErrors: error.isValidationError()
              ? error.getValidationErrors()
              : undefined,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Login failed",
        };
      } finally {
        setLoading(false);
      }
    },
    [setLogin, setLoading],
  );

  /**
   * Register a new user
   */
  const register = useCallback(
    async (data: RegisterInput): Promise<AuthResult> => {
      setLoading(true);
      try {
        const response = await authService.register(data);
        setLogin(response.user, response.accessToken);
        // Start automatic token refresh
        api.startTokenRefresh();
        return { success: true };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            success: false,
            error: error.message,
            code: error.code,
            validationErrors: error.isValidationError()
              ? error.getValidationErrors()
              : undefined,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Registration failed",
        };
      } finally {
        setLoading(false);
      }
    },
    [setLogin, setLoading],
  );

  /**
   * Logout current user
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout errors
    } finally {
      setLogout();
      localStorage.removeItem("travenest-auth");
      router.push("/");
    }
  }, [setLogout, router]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(
    async (data: ProfileUpdateInput): Promise<AuthResult> => {
      if (!user) {
        return {
          success: false,
          error: "Not authenticated",
          code: "UNAUTHORIZED",
        };
      }

      setLoading(true);
      try {
        const updatedUser = await userService.updatePersonalInfo(data);
        setUser(updatedUser);
        return { success: true };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            success: false,
            error: error.message,
            code: error.code,
            validationErrors: error.isValidationError()
              ? error.getValidationErrors()
              : undefined,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Update failed",
        };
      } finally {
        setLoading(false);
      }
    },
    [user, setUser, setLoading],
  );

  /**
   * Change password
   */
  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
    ): Promise<AuthResult> => {
      setLoading(true);
      try {
        await authService.changePassword(currentPassword, newPassword);
        return { success: true };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            success: false,
            error: error.message,
            code: error.code,
          };
        }
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Password change failed",
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading],
  );

  /**
   * Request password reset
   */
  const forgotPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      setLoading(true);
      try {
        await authService.forgotPassword(email);
        return { success: true };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            success: false,
            error: error.message,
            code: error.code,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Request failed",
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading],
  );

  /**
   * Reset password with token
   */
  const resetPassword = useCallback(
    async (resetToken: string, newPassword: string): Promise<AuthResult> => {
      setLoading(true);
      try {
        await authService.resetPassword(resetToken, newPassword);
        return { success: true };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            success: false,
            error: error.message,
            code: error.code,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Reset failed",
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading],
  );

  return {
    // State
    user,
    token,
    isAuthenticated,
    isLoading,
    // Actions
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
  };
}
