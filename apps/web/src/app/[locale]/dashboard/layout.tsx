import { CustomerSidebar } from "@/components/layout/CustomerSidebar";
import { Header } from "@/components/layout/Header";

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
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <CustomerSidebar locale={locale} />
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
