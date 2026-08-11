"use client";

import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Icon, type IconName } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/useI18n";

// 3 trụ cột của dự án (khớp thông điệp ở login + SEO).
// color = token --c-* để đồng bộ palette (thay vì hardcode hex).
const PILLARS: { icon: IconName; color: string }[] = [
  {
    icon: "mic",
    color: "var(--c-violet)",
  },
  {
    icon: "flame",
    color: "var(--c-amber)",
  },
  {
    icon: "sparkles",
    color: "var(--c-emerald)",
  },
];

const WEB_CREATORS: { iconSrc: string; name: string }[] = [
  { iconSrc: "/creator-icons/sinhvv.jpg", name: "Sinh" },
  { iconSrc: "/creator-icons/codex.svg", name: "Codex" },
  { iconSrc: "/creator-icons/claude.svg", name: "Claude Code" },
];

export default function AboutPage() {
  const { dictionary: m, href } = useI18n();
  const about = m.about;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-md)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo-mark-256.webp"
                  alt="Shadowing JP"
                  width={52}
                  height={52}
                  className="h-12 w-12 shrink-0 object-contain lg:hidden"
                  quality={75}
                />
                <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary sm:text-sm">
                  <Icon name="star" size={15} />
                  <span className="truncate">{about.eyebrow}</span>
                </div>
              </div>

              <h1 className="mt-5 text-2xl font-black leading-tight sm:mt-6 sm:text-4xl sm:leading-[1.15]">
                {about.titleLead}{" "}
                <span className="text-primary">{about.titleHighlight}</span>, {about.titleTail}
              </h1>

              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-muted sm:mt-5 sm:text-lg sm:leading-8">
                {about.intro}
              </p>
            </div>

            <div className="relative hidden shrink-0 self-center lg:block">
              <div className="pointer-events-none absolute inset-4 -z-10 rounded-full bg-primary/15 blur-3xl" />
              <Image
                src="/logo-mark-256.webp"
                alt="Shadowing JP"
                width={240}
                height={240}
                className="h-52 w-52 object-contain drop-shadow-[0_16px_40px_rgba(99,96,242,0.25)] xl:h-60 xl:w-60"
                quality={75}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4 sm:mt-8 sm:pt-6">
            <div className="grid gap-3 md:grid-cols-3 md:gap-4">
              {about.pillars.map((pillar, index) => {
                const p = PILLARS[index] ?? PILLARS[0];
                return (
                <div
                  key={p.icon}
                  className="rounded-xl border border-border bg-surface p-4 sm:rounded-2xl sm:p-5"
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl sm:h-11 sm:w-11"
                    style={{
                      background: `color-mix(in srgb, ${p.color} 12%, transparent)`,
                      color: p.color,
                    }}
                  >
                    <Icon name={p.icon} size={20} />
                  </span>
                  <h2 className="mt-3 text-[0.95rem] font-black leading-snug sm:text-base">
                    {pillar.title}
                  </h2>
                  <p className="mt-1.5 text-sm font-medium leading-6 text-muted">
                    {pillar.body}
                  </p>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] sm:rounded-[1.5rem]">
          <div className="grid gap-0 md:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="relative aspect-[4/3] max-h-64 overflow-hidden bg-surface md:aspect-auto md:max-h-none">
              <Image
                src="/author/nhat-ha-anime-768.webp"
                alt="Nhật Hà"
                fill
                sizes="(max-width: 768px) 100vw, 18rem"
                className="object-cover"
                quality={75}
              />
            </div>
            <div className="flex flex-col justify-center p-4 sm:p-8">
              <p className="text-sm font-black uppercase text-primary">{about.authorLabel}</p>
              <h2 className="mt-1.5 text-2xl font-black sm:mt-2 sm:text-3xl">Nhật Hà</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-muted sm:text-base">
                {about.authorSchool}
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:mt-5">
                {about.authorBody}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted/75">
                <span>※{about.webCreator}:</span>
                {WEB_CREATORS.map((creator) => (
                  <span key={creator.name} className="inline-flex items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creator.iconSrc}
                      alt=""
                      className="h-3.5 w-3.5 rounded-full object-cover opacity-75"
                    />
                    {creator.name}
                  </span>
                ))}
              </div>
              <div className="mt-4 max-w-2xl">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                  {about.devNote}
                </p>
                <div className="grid gap-2 text-xs leading-5 text-muted sm:grid-cols-2">
                  {[
                    [about.devBuildStyle, about.devBuildStyleValue],
                    [about.devFrontend, "Next.js + React"],
                    [about.devHosting, about.devHostingValue],
                    [about.devDatabase, about.devDatabaseValue],
                  ].map(([label, value]) => (
                    <p
                      key={label}
                      className="min-w-0 rounded-xl border border-border/70 bg-surface/70 px-3 py-2"
                    >
                      <span className="block font-black text-fg">{label}</span>
                      <span>{value}</span>
                    </p>
                  ))}
                  <p className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 sm:col-span-2">
                    <span className="font-black text-primary">
                      {about.pricingLabel}:
                    </span>{" "}
                    {about.pricing}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-[var(--shadow-sm)] sm:rounded-[1.5rem] sm:p-8">
          <h2 className="text-lg font-black sm:text-xl">{about.ctaTitle}</h2>
          <p className="max-w-md text-sm font-medium leading-6 text-muted">
            {about.ctaBody}
          </p>
          <Link href={href("/courses")} className={buttonClasses("primary", "lg", "mt-1 w-full sm:w-auto")}>
            {about.cta}
            <Icon name="arrow-right" size={18} />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
