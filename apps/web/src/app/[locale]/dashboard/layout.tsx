import { CustomerSidebar } from "@/components/layout/CustomerSidebar";
import { Footer } from "@/components/layout/Footer";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DashboardLayout({
  children,
  params,
}: LayoutProps) {
  const { locale } = await params;

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-surface)]">
      <CustomerSidebar locale={locale} />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {children}
        <Footer />
      </main>
    </div>
  );
}
