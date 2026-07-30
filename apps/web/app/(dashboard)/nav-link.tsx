"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
        active
          ? "bg-raised text-fg"
          : "text-muted hover:bg-raised/60 hover:text-fg"
      }`}
    >
      {active ? (
        <span className="bg-amber absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full" />
      ) : null}
      {icon ? (
        <span className={active ? "text-fg" : "text-muted"}>{icon}</span>
      ) : null}
      {children}
    </Link>
  );
}
