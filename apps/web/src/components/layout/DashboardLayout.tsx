import { CustomerSidebar } from "./CustomerSidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  locale: string;
}

export function DashboardLayout({ children, locale }: DashboardLayoutProps) {
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
