import { Sidebar } from "./sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7 [scrollbar-gutter:stable]">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
