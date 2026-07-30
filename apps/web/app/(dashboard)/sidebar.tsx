import Link from "next/link";
import { logout } from "@/app/login/actions";
import { HindcastMark } from "@/components/hindcast-mark";
import { NavLink } from "./nav-link";

function ProjectsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  );
}

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-edge bg-surface">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <HindcastMark className="text-amber h-5 w-5" />
          <span className="text-[15px] font-semibold tracking-tight">
            hindcast
          </span>
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 pt-1">
        <NavLink href="/projects" icon={<ProjectsIcon />}>
          Projects
        </NavLink>
      </nav>

      <form action={logout} className="mt-auto px-3 pb-4">
        <button
          type="submit"
          className="text-muted hover:bg-raised/60 hover:text-fg flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Sign out
        </button>
      </form>
    </aside>
  );
}
