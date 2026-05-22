"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="text-center max-w-lg">
            <div className="text-red-500 text-6xl mb-6">🚨</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Critical Error
            </h1>
            <p className="text-gray-600 mb-6">
              We apologize for the inconvenience. A critical error has occurred.
              Please try refreshing the page or contact our support team.
            </p>
            <div className="space-x-4">
              <button
                onClick={reset}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Try again
              </button>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Go to Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
