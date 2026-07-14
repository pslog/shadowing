"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/icon";

export default function AboutPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-md)] sm:p-8 lg:p-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
              <Icon name="mic" size={15} />
              Luyện hội thoại bằng cách bắt chước
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.05] sm:text-6xl">
              Shadowing để{" "}
              <span className="text-primary">nói được</span>, không chỉ nghe hiểu.
            </h1>

            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-muted">
              Muốn giao tiếp tốt, mình cần quen tai, quen miệng và quen cả cách người
              Nhật nối ý. Vì vậy mỗi bài học nên bắt đầu từ âm thanh thật, câu thật,
              tình huống thật.
            </p>
          </div>

          <div className="mt-8 border-l-4 border-primary pl-4">
            <p className="text-sm font-black uppercase text-primary">
              Mục tiêu là phản xạ, không phải học thuộc lòng máy móc
            </p>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-muted">
              Khi một mẫu câu đã đủ quen, mình không còn dịch trong đầu quá lâu.
              Cách học chỉ cần gọn: nghe câu thật, nhại lại thành tiếng, rồi dùng
              được khi gặp đúng tình huống.
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
                học tiếng Nhật từng ngày như mọi người. Hà tạo góc học này để tự nhắc
                mình luyện nói đều hơn, và để có thêm bạn đồng hành trên cùng hành
                trình.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                Streak ở đây chỉ là một nhịp nhỏ mỗi ngày: mở bài lên, nghe một câu,
                nói theo một câu, rồi giữ thói quen đó lâu hơn một chút. Không thi đua,
                không áp lực, chỉ cùng nhau luyện kaiwa theo cách nhẹ nhàng và bền bỉ.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
