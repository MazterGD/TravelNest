"use client";

import { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorFallback } from "./ErrorFallback";

interface ClientErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Client-side ErrorBoundary wrapper for use in Server Components
 * This wrapper can be imported and used in Server Components because
 * it doesn't require passing functions as props
 */
export function ClientErrorBoundary({ children }: ClientErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
}
