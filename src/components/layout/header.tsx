"use client";

import { signOut } from "next-auth/react";
import { LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface HeaderProps {
  title: string;
  userName?: string;
}

export function Header({ title, userName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 md:px-6 bg-white border-b border-gray-200">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-2">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4 text-gray-500" />
          </Button>
        </Link>
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <span className="hidden sm:block text-sm text-gray-700 font-medium">{userName || "Admin"}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="w-4 h-4 text-gray-500" />
          </Button>
        </div>
      </div>
    </header>
  );
}
