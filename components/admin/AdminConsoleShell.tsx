"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

const ADMIN_TABS: Array<{
  href: string;
  label: string;
  description: string;
  icon: IconName;
}> = [
  {
    href: "/admin/users",
    label: "ユーザー管理",
    description: "権限と学習状況",
    icon: "cap",
  },
  {
    href: "/admin/lesson-views",
    label: "閲覧統計",
    description: "Lesson views",
    icon: "trending",
  },
];

export function AdminConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-fg">管理</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav
            aria-label="管理メニュー"
            className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-sm)] lg:flex-col lg:overflow-visible"
          >
            {ADMIN_TABS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "focus-ring flex min-w-44 items-center gap-3 rounded-xl px-3 py-3 text-left transition-all lg:min-w-0",
                    active
                      ? "bg-primary text-primary-fg shadow-[var(--shadow-glow)]"
                      : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                      active ? "bg-white/18" : "bg-surface text-primary",
                    )}
                  >
                    <Icon name={item.icon} size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">{item.label}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        active ? "text-primary-fg/75" : "text-muted",
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </AppShell>
  );
}
