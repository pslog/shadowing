"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/icon";

export default function AboutPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-md)] sm:p-8 lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                <Icon name="mic" size={15} />
                Một góc học chung cho cộng đồng
              </div>

              <h1 className="mt-6 text-2xl font-black leading-[1.15] sm:text-4xl">
                Shadowing để{" "}
                <span className="text-primary">cùng nói tốt hơn</span>, không chỉ nghe hiểu.
              </h1>

              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-muted">
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

          <div className="mt-8 border-l-4 border-primary pl-4">
            <p className="text-sm font-black uppercase text-primary">
              Mục tiêu là tạo thói quen nói, không phải chạy theo thành tích
            </p>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-muted">
              Mỗi người chỉ cần góp một nhịp nhỏ: nghe câu thật, nói lại thành tiếng,
              giữ streak hôm nay, rồi quay lại ngày mai. Khi nhiều người cùng giữ nhịp,
              việc học bớt cô đơn và dễ đi xa hơn.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-sm)]">
          <div className="grid gap-0 md:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="relative aspect-square overflow-hidden bg-surface md:aspect-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/author/nhat-ha-anime.png"
                alt="Avatar anime của tác giả Nhật Hà"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-sm font-black uppercase text-primary">Tác giả</p>
              <h2 className="mt-2 text-3xl font-black">Nhật Hà</h2>
              <p className="mt-2 text-base font-bold text-muted">
                Sinh viên Đại học Ngoại ngữ - Đại học Đà Nẵng
              </p>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
                Nhật Hà là cô sinh viên Đại học Ngoại ngữ - Đại học Đà Nẵng, cũng đang
                học tiếng Nhật từng ngày như mọi người. Hà tạo góc học này như một
                đóng góp nhỏ cho cộng đồng học tiếng Nhật, để ai cần một nơi luyện nói
                đều có thể vào học cùng.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                Streak ở đây chỉ là một nhịp nhỏ mỗi ngày: mở bài lên, nghe một câu,
                nói theo một câu, rồi giữ thói quen đó lâu hơn một chút. Không thi đua,
                không áp lực, không vì lợi ích cá nhân; chỉ cùng nhau luyện kaiwa theo
                cách nhẹ nhàng và bền bỉ.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
