"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button, buttonClasses } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/useI18n";

export default function ErrorPage({ unstable_retry }: { unstable_retry: () => void }) {
  const { locale, href } = useI18n();
  return (
    <AppShell>
      <section className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">
          {locale === "vi" ? "Chưa thể tải trang" : "ページを読み込めませんでした"}
        </h1>
        <p role="alert" className="mt-3 text-muted">
          {locale === "vi" ? "Bạn có thể thử lại hoặc quay về danh sách khóa học." : "もう一度お試しいただくか、コース一覧に戻ってください。"}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={unstable_retry}>{locale === "vi" ? "Thử lại" : "再試行"}</Button>
          <Link href={href("/courses")} className={buttonClasses("outline")}>
            {locale === "vi" ? "Xem khóa học" : "コース一覧"}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
