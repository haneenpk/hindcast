import Link from "next/link";
import { NavLink } from "./nav-link";

export function Sidebar() {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-edge bg-surface">
      <div className="px-4 pt-5 pb-6">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden>
            <path d="M16 10v12l-8.5-6z" fill="var(--color-amber)" />
            <path d="M25 10v12l-8.5-6z" fill="var(--color-amber)" opacity="0.45" />
          </svg>
          <span className="font-mono text-[13px] font-medium tracking-tight">
            hindcast
          </span>
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        <NavLink href="/projects">Projects</NavLink>
      </nav>

      <div className="mt-auto px-2 pb-4" />
    </aside>
  );
}
