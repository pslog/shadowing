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
import { ReadingArticle } from "./ReadingArticle";
import { DialogueScript } from "./DialogueScript";
import {
  buildReadingParagraphs,
  readingMemo,
  readingWatermark,
} from "./reading-content";

/**
 * What a signed-out visitor sees instead of a lesson.
 *
 * A blank "please log in" screen asks for an account before showing anything
 * worth having one for, so this keeps the lesson's own identity visible — title,
 * badges, the opening lines fading out under a mask — and puts the ask directly
 * underneath. Nothing here claims the content is paid: the account exists to
 * remember what you read and how far you got, and the copy says exactly that.
 *
 * The teaser runs long on purpose — long enough to get absorbed in — but never
 * includes audio or the recorder, so what it gives away is reading time, not
 * the lesson. A 読解 passage is rendered by the REAL article component, faded
 * out partway: the visitor sees the page they are being invited into, not a
 * stripped-down quote of it.
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

  // Reading: the first paragraphs, through the article's own renderer.
  const paragraphs = reading
    ? buildReadingParagraphs(lesson, sentences).slice(0, 3)
    : [];
  const titleMatch = lesson.title.match(/^(.*?)\s*[「『]([^」』]+)[」』]\s*$/);
  const preview = sentences.slice(0, 8);

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
        };

  return (
    <div className="space-y-5">
      {reading ? (
        <ReadingArticle
          label={titleMatch?.[1] || (lesson.topic ?? "")}
          heading={titleMatch?.[2] ?? lesson.title}
          note={readingMemo(lesson, locale)}
          watermark={readingWatermark(lesson)}
          paragraphs={paragraphs}
          missingTranslationText=""
          fade
          chips={
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-bold text-muted">
              {lesson.level && (
                <span className="inline-flex h-8 items-center rounded-full border border-border/70 bg-card/85 px-3 shadow-sm backdrop-blur">
                  {lesson.level}
                </span>
              )}
              <span className="inline-flex h-8 items-center rounded-full border border-border/70 bg-card/85 px-3 tabular-nums shadow-sm backdrop-blur">
                {sentences.length}
                {m.common.sentences}
              </span>
              <span className="inline-flex h-8 items-center rounded-full border border-border/70 bg-card/85 px-3 tabular-nums shadow-sm backdrop-blur">
                {lesson.vocabulary?.length ?? 0}
                {m.common.words}
              </span>
            </div>
          }
        />
      ) : (
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
      </section>
      )}

      {!reading && (
        // The player's own Step-1 panel, in preview mode: same header, same line
        // cards with furigana — just no audio, no practice buttons, faded out.
        <DialogueScript sentences={preview} preview t={m.player} />
      )}

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
