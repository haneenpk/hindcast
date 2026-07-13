"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-raised text-fg"
          : "text-muted hover:bg-raised/60 hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}
