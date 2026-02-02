"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  FaHome,
  FaClipboardList,
  FaCalendarAlt,
  FaStar,
  FaUser,
} from "react-icons/fa";

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CustomerSidebarProps {
  locale: string;
}

export function CustomerSidebar({ locale }: CustomerSidebarProps) {
  const pathname = usePathname();

  const menuItems: SidebarItem[] = [
    {
      id: "overview",
      label: "Overview",
      href: `/${locale}/dashboard`,
      icon: FaHome,
    },
    {
      id: "quotations",
      label: "Quotations",
      href: `/${locale}/dashboard/quotations`,
      icon: FaClipboardList,
    },
    {
      id: "bookings",
      label: "Bookings",
      href: `/${locale}/dashboard/bookings`,
      icon: FaCalendarAlt,
    },
    {
      id: "reviews",
      label: "Reviews",
      href: `/${locale}/dashboard/reviews`,
      icon: FaStar,
    },
    {
      id: "profile",
      label: "Profile",
      href: `/${locale}/dashboard/profile`,
      icon: FaUser,
    },
  ];

  const isActive = (href: string) => {
    if (href === `/${locale}/dashboard`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="sticky top-0 py-6">
        {/* Logo/Brand */}
        {/* <div className="px-6 mb-8">
          <Link
            href={`/${locale}/dashboard`}
            className="flex items-center gap-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B5F7F] text-white font-bold text-lg">
              T
            </div>
            <span className="text-xl font-bold text-gray-900">TraveNest</span>
          </Link>
        </div> */}

        {/* Navigation Menu */}
        <nav className="px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-[#0B5F7F] text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
