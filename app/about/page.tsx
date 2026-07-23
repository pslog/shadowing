"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Icon, type IconName } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";

// 3 trụ cột của dự án (khớp thông điệp ở login + SEO).
// color = token --c-* để đồng bộ palette (thay vì hardcode hex).
const PILLARS: { icon: IconName; color: string; title: string; body: string }[] = [
  {
    icon: "mic",
    color: "var(--c-violet)",
    title: "Nói được, không chỉ nghe hiểu",
    body: "Kaiwa tốt bắt đầu từ shadowing: nghe câu thật rồi nói lại từng câu để luyện phản xạ hội thoại, phát âm được chấm ngay để bạn biết đường sửa.",
  },
  {
    icon: "flame",
    color: "var(--c-amber)",
    title: "Mỗi ngày một ít, thành thói quen",
    body: "Giữ streak, cố gắng một chút mỗi ngày để việc học thành nếp. Khi phản xạ đã quen, mang bài thoại ra dùng trong tình huống thực tế.",
  },
  {
    icon: "sparkles",
    color: "var(--c-emerald)",
    title: "Cùng cộng đồng tiến bộ",
    body: "Học cùng nhau bớt cô đơn và đi xa hơn. Kaiwa vững lên thì việc học và công việc bằng tiếng Nhật cũng thuận lợi hơn.",
  },
];

export default function AboutPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-md)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-mark.png"
                  alt="Shadowing JP"
                  width={52}
                  height={52}
                  className="h-12 w-12 shrink-0 object-contain lg:hidden"
                />
                <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary sm:text-sm">
                  <Icon name="star" size={15} />
                  <span className="truncate">Một góc học chung cho cộng đồng</span>
                </div>
              </div>

              <h1 className="mt-5 text-2xl font-black leading-tight sm:mt-6 sm:text-4xl sm:leading-[1.15]">
                Shadowing để{" "}
                <span className="text-primary">cùng nói tốt hơn</span>, không chỉ nghe hiểu.
              </h1>

              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-muted sm:mt-5 sm:text-lg sm:leading-8">
                Shadowing JP được làm cho những người đang học tiếng Nhật cùng có một
                nơi luyện nói nhẹ nhàng mỗi ngày. Không bán khóa học, không đặt lợi ích
                cá nhân lên trước, chỉ cùng nhau nghe, nói lại và tiến bộ từng chút.
              </p>
            </div>

            <div className="relative hidden shrink-0 self-center lg:block">
              <div className="pointer-events-none absolute inset-4 -z-10 rounded-full bg-primary/15 blur-3xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.png"
                alt="Shadowing JP"
                width={240}
                height={240}
                className="h-52 w-52 object-contain drop-shadow-[0_16px_40px_rgba(99,96,242,0.25)] xl:h-60 xl:w-60"
              />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4 sm:mt-8 sm:pt-6">
            <div className="grid gap-3 md:grid-cols-3 md:gap-4">
              {PILLARS.map((p) => (
                <div
                  key={p.title}
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
                    {p.title}
                  </h2>
                  <p className="mt-1.5 text-sm font-medium leading-6 text-muted">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] sm:rounded-[1.5rem]">
          <div className="grid gap-0 md:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="relative aspect-[4/3] max-h-64 overflow-hidden bg-surface md:aspect-auto md:max-h-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/author/nhat-ha-anime.png"
                alt="Avatar anime của tác giả Nhật Hà"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-center p-4 sm:p-8">
              <p className="text-sm font-black uppercase text-primary">Tác giả</p>
              <h2 className="mt-1.5 text-2xl font-black sm:mt-2 sm:text-3xl">Nhật Hà</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-muted sm:text-base">
                Sinh viên Đại học Ngoại ngữ - Đại học Đà Nẵng
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:mt-5">
                Hà cũng đang học tiếng Nhật mỗi ngày như bạn. Góc học này là một đóng
                góp nhỏ của Hà cho cộng đồng - để ai cần một nơi luyện nói đều có thể
                vào học cùng, nhẹ nhàng và bền bỉ.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-[var(--shadow-sm)] sm:rounded-[1.5rem] sm:p-8">
          <h2 className="text-lg font-black sm:text-xl">Sẵn sàng luyện nói chưa?</h2>
          <p className="max-w-md text-sm font-medium leading-6 text-muted">
            Mở một bài, nghe một câu, nói theo một câu. Bắt đầu từ hôm nay.
          </p>
          <Link href="/courses" className={buttonClasses("primary", "lg", "mt-1 w-full sm:w-auto")}>
            Bắt đầu luyện nói
            <Icon name="arrow-right" size={18} />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
