"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { MascotBadge } from "@/components/ui/mascot";
import { levelMascot } from "@/lib/gamification/level";
import { stripLocale } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/useI18n";
import type { Lesson, LessonSentence } from "@/lib/types";

/**
 * What a signed-out visitor sees instead of a lesson.
 *
 * A blank "please log in" screen asks for an account before showing anything
 * worth having one for, so this keeps the lesson's own identity visible — title,
 * badges, the opening lines fading out under a mask — and puts the ask directly
 * underneath. Nothing here claims the content is paid: the account exists to
 * remember what you read and how far you got, and the copy says exactly that.
 *
 * The teaser is deliberately short (a couple of lines) and never includes audio
 * or the recorder — enough to recognise the lesson, not enough to replace it.
 */
export function LessonGuestWall({
  lesson,
  sentences,
  reading,
  backHref,
}: {
  lesson: Lesson;
  sentences: LessonSentence[];
  /** 読解 lessons preview as prose; shadowing lessons as separate lines. */
  reading: boolean;
  backHref: string;
}) {
  const { locale, href, dictionary: m } = useI18n();
  const pathname = usePathname();
  // Come back to this exact lesson once signed in.
  const next = stripLocale(pathname || "/");
  const mascot = levelMascot(1);

  const preview = reading
    ? [sentences.slice(0, 4).map((sentence) => sentence.ja_text).join("")]
    : sentences.slice(0, 3).map((sentence) => sentence.ja_text);

  const copy =
    locale === "vi"
      ? {
          free: "Miễn phí 100%",
          title: "Đăng nhập để mở bài học",
          body: "Toàn bộ bài học ở đây đều miễn phí. Mình chỉ cần bạn đăng nhập để nhớ hôm nay bạn đã học gì và đang đi tới đâu — streak, XP và linh vật theo level đều lớn lên từ đó.",
          perks: [
            "Ghi nhớ tiến độ mỗi ngày",
            "Streak & XP",
            "Linh vật theo level",
            "Sổ từ vựng riêng",
          ],
          cta: "Đăng nhập / Đăng ký miễn phí",
          back: "Về khóa học",
          note: "Không mất phí, chỉ cần email.",
          teaserLabel: "Mở đầu bài",
        }
      : {
          free: "すべて無料",
          title: "ログインしてレッスンを開く",
          body: "レッスンはすべて無料です。ログインが必要なのは、今日どこまで学んだかを覚えておくため。ストリークもXPも、レベルごとの相棒もそこから育ちます。",
          perks: [
            "毎日の学習記録",
            "ストリークとXP",
            "レベルごとの相棒",
            "自分の単語帳",
          ],
          cta: "無料でログイン / 登録",
          back: "コースへ戻る",
          note: "料金はかかりません。メールアドレスだけで大丈夫です。",
          teaserLabel: "冒頭",
        };

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-sm)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="px-5 py-5 text-center sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
            {lesson.topic && (
              <span className="inline-flex h-7 items-center rounded-full border border-primary/15 bg-primary/8 px-3 text-primary">
                {lesson.topic}
              </span>
            )}
            {lesson.level && (
              <span className="inline-flex h-7 items-center rounded-full border border-border/70 bg-surface px-3 text-muted">
                {lesson.level}
              </span>
            )}
            <span className="inline-flex h-7 items-center rounded-full border border-border/70 bg-surface px-3 tabular-nums text-muted">
              {sentences.length}
              {m.common.sentences}
            </span>
          </div>
          <h1 lang="ja" className="mt-3 text-3xl font-black leading-tight text-fg sm:text-4xl">
            {lesson.title}
          </h1>
        </div>

        {/* The teaser: real content, cut off mid-thought by a mask rather than
            by an ellipsis, so the page reads as "there is more" instead of
            "there is nothing". */}
        <div className="relative border-t border-border bg-surface/50 px-5 pb-10 pt-5 sm:px-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted">
            {copy.teaserLabel}
          </p>
          <div
            aria-hidden
            className="mt-2 space-y-2 [mask-image:linear-gradient(180deg,#000_35%,transparent_95%)]"
          >
            {preview.map((line, i) => (
              <p
                key={i}
                lang="ja"
                className="select-none text-[1.05rem] font-medium leading-[2.1] text-fg/85"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-primary/[0.06] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <MascotBadge slug={mascot.slug} accent={mascot.accent} size={64} />
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--success)]">
              <Icon name="sparkles" size={13} />
              {copy.free}
            </p>
            <h2 className="mt-3 text-xl font-extrabold text-fg sm:text-2xl">
              {copy.title}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              {copy.body}
            </p>
          </div>

          <ul className="grid w-full max-w-md grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {copy.perks.map((perk) => (
              <li
                key={perk}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-fg"
              >
                <Icon name="check" size={15} className="shrink-0 text-primary" />
                {perk}
              </li>
            ))}
          </ul>

          <div className="flex w-full max-w-md flex-col gap-2">
            <Link
              href={href(`/login?next=${encodeURIComponent(next)}`)}
              className={`${buttonClasses("primary")} w-full`}
            >
              {copy.cta}
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link href={href(backHref)} className={`${buttonClasses("ghost")} w-full`}>
              {copy.back}
            </Link>
          </div>
          <p className="text-xs font-semibold text-muted">{copy.note}</p>
        </div>
      </section>
    </div>
  );
}
