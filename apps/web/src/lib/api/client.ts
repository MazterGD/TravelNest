/**
 * API Client for TraveNest
 * Industry-standard HTTP client with interceptors, error handling, and token refresh
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestConfig {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  cache?: RequestCache;
  tags?: string[];
  skipAuth?: boolean;
  timeout?: number;
}

/**
 * Standardized API Error class
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp?: string;
  public readonly requestId?: string;

  constructor(
    status: number,
    message: string,
    code: string = "UNKNOWN_ERROR",
    details?: unknown,
    meta?: { timestamp?: string; requestId?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.timestamp = meta?.timestamp;
    this.requestId = meta?.requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Check if error is a specific HTTP status
   */
  isStatus(status: number): boolean {
    return this.status === status;
  }

  /**
   * Check if error is authentication related
   */
  isAuthError(): boolean {
    return this.status === 401 || this.code === "TOKEN_EXPIRED";
  }

  /**
   * Check if error is validation related
   */
  isValidationError(): boolean {
    return this.status === 422 || this.code === "VALIDATION_ERROR";
  }

  /**
   * Get validation errors as a map
   */
  getValidationErrors(): Record<string, string> {
    if (!this.isValidationError() || !Array.isArray(this.details)) {
      return {};
    }
    return (this.details as Array<{ field: string; message: string }>).reduce(
      (acc, err) => {
        acc[err.field] = err.message;
        return acc;
      },
      {} as Record<string, string>,
    );
  }
}

/**
 * Token refresh state management
 */
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let refreshIntervalId: NodeJS.Timeout | null = null;

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

/**
 * Main API Client class
 */
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private requestTimeout: number;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    this.requestTimeout = 30000; // 30 seconds
  }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem("travenest-auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.state?.token || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Set authentication token in storage
   */
  private setAuthToken(token: string): void {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem("travenest-auth");
      const parsed = stored ? JSON.parse(stored) : { state: {} };
      parsed.state.token = token;
      localStorage.setItem("travenest-auth", JSON.stringify(parsed));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Clear authentication token from storage
   */
  private clearAuthToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("travenest-auth");
  }

  /**
   * Decode JWT token to extract expiry time
   */
  private decodeToken(token: string): { exp?: number } | null {
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired or will expire soon (within 5 minutes)
   */
  private isTokenExpiringSoon(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    // Return true if token expires within 5 minutes
    return expiryTime - now < fiveMinutes;
  }

  /**
   * Start automatic token refresh
   * Checks every minute if token needs refresh (expires within 5 minutes)
   */
  public startTokenRefresh(): void {
    if (typeof window === "undefined") return;

    // Clear any existing interval
    this.stopTokenRefresh();

    // Check immediately
    this.checkAndRefreshToken();

    // Check every minute
    refreshIntervalId = setInterval(() => {
      this.checkAndRefreshToken();
    }, 60 * 1000); // 1 minute
  }

  /**
   * Stop automatic token refresh
   */
  public stopTokenRefresh(): void {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
  }

  /**
   * Check token expiry and refresh if needed
   */
  private async checkAndRefreshToken(): Promise<void> {
    const token = this.getAuthToken();
    if (!token) {
      this.stopTokenRefresh();
      return;
    }

    // Only refresh if token is expiring soon and not already refreshing
    if (this.isTokenExpiringSoon(token) && !isRefreshing) {
      try {
        await this.handleTokenRefresh();
      } catch (error) {
        console.error("[TokenRefresh] Failed to refresh token:", error);
        this.stopTokenRefresh();
        // Dispatch auth error event
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("auth:error", {
              detail: { error },
            }),
          );
        }
      }
    }
  }

  /**
   * Attempt to refresh the access token
   */
  private async refreshAccessToken(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh-token`, {
        method: "POST",
        headers: this.defaultHeaders,
        credentials: "include", // Include cookies for refresh token
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      const newToken = data.data?.accessToken;

      if (newToken) {
        this.setAuthToken(newToken);
        return newToken;
      }

      throw new Error("No token in refresh response");
    } catch {
      this.clearAuthToken();
      throw new ApiError(
        401,
        "Session expired. Please login again.",
        "TOKEN_EXPIRED",
      );
    }
  }

  /**
   * Handle token refresh with request queuing
   */
  private async handleTokenRefresh(): Promise<string> {
    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((token: string) => resolve(token));
      });
    }

    isRefreshing = true;

    try {
      const newToken = await this.refreshAccessToken();
      onTokenRefreshed(newToken);
      return newToken;
    } finally {
      isRefreshing = false;
    }
  }

  /**
   * Get CSRF token from cookie
   */
  private getCSRFToken(): string | null {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "csrf-token") {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * Create AbortController with timeout
   */
  private createAbortController(timeout: number): {
    controller: AbortController;
    timeoutId: NodeJS.Timeout;
  } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return { controller, timeoutId };
  }

  /**
   * Main request method
   */
  private async request<T>(
    endpoint: string,
    config: RequestConfig = {},
    retryCount = 0,
  ): Promise<T> {
    const {
      method = "GET",
      body,
      headers = {},
      cache,
      tags,
      skipAuth = false,
      timeout = this.requestTimeout,
    } = config;

    // Build headers
    const token = skipAuth ? null : this.getAuthToken();
    const requestHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing methods
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        requestHeaders["x-csrf-token"] = csrfToken;
      }
    }

    // Generate request ID for tracing
    const requestId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    requestHeaders["X-Request-ID"] = requestId;

    // Build fetch config
    const fetchConfig: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: "include", // Include cookies
    };

    if (cache) fetchConfig.cache = cache;
    if (body && method !== "GET") {
      fetchConfig.body = JSON.stringify(body);
    }

    // Add Next.js specific options for caching
    if (tags) {
      (fetchConfig as { next?: { tags: string[] } }).next = { tags };
    }

    // Create abort controller for timeout
    const { controller, timeoutId } = this.createAbortController(timeout);
    fetchConfig.signal = controller.signal;

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, fetchConfig);

      clearTimeout(timeoutId);

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      const responseData = await response.json();

      // Handle successful response
      if (response.ok && responseData.success) {
        return responseData.data as T;
      }

      // Handle error response
      const error = responseData.error || {};
      const apiError = new ApiError(
        response.status,
        error.message || "An error occurred",
        error.code || "UNKNOWN_ERROR",
        error.details,
        responseData.meta,
      );

      // Handle token expiration with automatic refresh
      if (
        response.status === 401 &&
        error.code === "TOKEN_EXPIRED" &&
        retryCount === 0 &&
        !skipAuth
      ) {
        try {
          await this.handleTokenRefresh();
          // Retry the original request with new token
          return this.request<T>(endpoint, config, retryCount + 1);
        } catch (refreshError) {
          // Dispatch auth error event for global handling
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("auth:error", {
                detail: { error: refreshError },
              }),
            );
          }
          throw refreshError;
        }
      }

      throw apiError;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(408, "Request timeout", "REQUEST_TIMEOUT");
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new ApiError(
          0,
          "Network error. Please check your connection.",
          "NETWORK_ERROR",
        );
      }

      // Re-throw ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ApiError(
        500,
        error instanceof Error ? error.message : "An unexpected error occurred",
        "UNKNOWN_ERROR",
      );
    }
  }

  // HTTP method shortcuts
  get<T>(endpoint: string, config?: Omit<RequestConfig, "method" | "body">) {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  post<T>(
    endpoint: string,
    body?: unknown,
    config?: Omit<RequestConfig, "method" | "body">,
  ) {
    return this.request<T>(endpoint, { ...config, method: "POST", body });
  }

  put<T>(
    endpoint: string,
    body?: unknown,
    config?: Omit<RequestConfig, "method" | "body">,
  ) {
    return this.request<T>(endpoint, { ...config, method: "PUT", body });
  }

  patch<T>(
    endpoint: string,
    body?: unknown,
    config?: Omit<RequestConfig, "method" | "body">,
  ) {
    return this.request<T>(endpoint, { ...config, method: "PATCH", body });
  }

  delete<T>(endpoint: string, config?: Omit<RequestConfig, "method" | "body">) {
    return this.request<T>(endpoint, { ...config, method: "DELETE" });
  }

  /**
   * Upload file with FormData
   */
  async upload<T>(
    endpoint: string,
    formData: FormData,
    config?: Omit<RequestConfig, "method" | "body" | "headers">,
  ): Promise<T> {
    const token = this.getAuthToken();
    const requestHeaders: Record<string, string> = {};

    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }

    const requestId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    requestHeaders["X-Request-ID"] = requestId;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: requestHeaders,
      body: formData,
      credentials: "include",
    });

    const responseData = await response.json();

    if (response.ok && responseData.success) {
      return responseData.data as T;
    }

    const error = responseData.error || {};
    throw new ApiError(
      response.status,
      error.message || "Upload failed",
      error.code || "UPLOAD_ERROR",
      error.details,
      responseData.meta,
    );
  }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);
