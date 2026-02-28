"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarDays,
  Receipt,
  Zap,
  BarChart3,
  Settings,
  Milk,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/daily-entry", label: "Daily Entry", icon: ClipboardList },
  { href: "/monthly-entry", label: "Monthly View", icon: CalendarDays },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/quick-bill", label: "Quick Bill", icon: Zap },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-white border-r border-gray-200 fixed top-0 left-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50">
        <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl shadow-md">
          <Milk className="w-5 h-5 text-white" />
          {/* small dot accent */}
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" />
        </div>
        <div>
          <p className="font-extrabold text-gray-900 text-sm leading-tight tracking-tight">Dairy Billing</p>
          <p className="text-[10px] text-blue-500 font-medium tracking-wide uppercase">Management System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={cn("w-4.5 h-4.5", active ? "text-blue-600" : "text-gray-400")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-400">
        © {new Date().getFullYear()} Dairy Billing
      </div>
    </aside>
  );
}
