"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useI18n } from "@/components/i18n/useI18n";
import { stripLocale } from "@/lib/i18n";

type AdminTabKey = "users" | "views";

const ADMIN_TABS: Array<{ href: string; key: AdminTabKey; icon: IconName }> = [
  { href: "/admin/users", key: "users", icon: "cap" },
  { href: "/admin/lesson-views", key: "views", icon: "trending" },
];

export function AdminConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dictionary, href: localizedHref } = useI18n();
  const t = dictionary.adminShell;
  const path = stripLocale(pathname || "/");
  const tabLabels: Record<AdminTabKey, { label: string; description: string }> = {
    users: { label: t.usersLabel, description: t.usersDescription },
    views: { label: t.viewsLabel, description: t.viewsDescription },
  };

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-fg">{t.heading}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav
            aria-label={t.menuLabel}
            className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-sm)] lg:flex-col lg:overflow-visible"
          >
            {ADMIN_TABS.map((item) => {
              const active = path === item.href || path.startsWith(`${item.href}/`);
              const labels = tabLabels[item.key];
              return (
                <Link
                  key={item.href}
                  href={localizedHref(item.href)}
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
                    <span className="block text-sm font-extrabold">{labels.label}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        active ? "text-primary-fg/75" : "text-muted",
                      )}
                    >
                      {labels.description}
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
