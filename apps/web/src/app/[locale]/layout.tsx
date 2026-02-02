import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const locales = ["en", "si", "ta"];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <ErrorBoundary
            fallback={(error, reset) => (
              <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="text-center max-w-lg">
                  <div className="text-red-500 text-6xl mb-6">⚠️</div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    Something went wrong
                  </h1>
                  <p className="text-gray-600 mb-6">
                    We apologize for the inconvenience. An unexpected error has occurred.
                    Please try refreshing the page or contact support if the problem persists.
                  </p>
                  <div className="space-x-4">
                    <button
                      onClick={reset}
                      className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      Try again
                    </button>
                    <button
                      onClick={() => window.location.href = '/'}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Go to Home
                    </button>
                  </div>
                  {process.env.NODE_ENV === 'development' && (
                    <details className="mt-8 text-left">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        Error Details (Development)
                      </summary>
                      <pre className="mt-4 p-4 bg-gray-100 rounded-lg text-sm overflow-auto text-red-600">
                        {error.message}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}
          >
            {children}
          </ErrorBoundary>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
