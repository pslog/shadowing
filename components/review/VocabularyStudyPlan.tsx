"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { todayKey } from "@/lib/date";
import type { VocabularyBookEntry, VocabularyBookPlan } from "@/lib/types";
import {
  addDays,
  buildSchedule,
  entryWordKeys,
  LEARN_DAYS_PER_WEEK,
  totalWords,
  type PlanItem,
  type PlanProgress,
} from "@/lib/vocab/plan";

type Locale = "vi" | "ja";

const planCopy = {
  vi: {
    setupTitle: "Lập lộ trình học",
    setupBody: "Chia sổ thành từng ngày: 6 ngày học mới, ngày thứ 7 tổng ôn. Mỗi ngày bạn biết chính xác phải học chữ nào.",
    paces: ["Cấp tốc", "Chuẩn", "Thong thả"],
    recommended: "Gợi ý",
    custom: "Tùy chỉnh",
    wordsPerDay: (count: number) => `${count} từ/ngày`,
    paceMeta: (days: number, finish: string) => `${days} ngày · xong ${finish}`,
    start: "Bắt đầu lộ trình",
    save: "Lưu lộ trình mới",
    cancel: "Hủy",
    totalMeta: (words: number, items: number, unit: string) => `${items} ${unit} · ${words} từ`,
    today: "Hôm nay",
    ahead: "Học trước",
    learnDay: (day: number) => `Ngày ${day}`,
    reviewDay: (week: number) => `Tổng ôn tuần ${week}`,
    week: (week: number) => `Tuần ${week}`,
    of: (done: number, total: number) => `${done}/${total} ngày`,
    finishOn: (date: string) => `Dự kiến xong ${date}`,
    onTrack: "Đúng tiến độ",
    behind: (days: number) => `Chậm ${days} ngày`,
    aheadBy: (days: number) => `Đi trước ${days} ngày`,
    behindTitle: (days: number) => `Bạn đang chậm ${days} ngày so với lộ trình`,
    behindBody: "Không cần học dồn. Dời lịch để tiếp tục từ hôm nay, hoặc học thêm một ngày mỗi khi có thời gian để đuổi kịp.",
    shift: "Dời lịch",
    range: (first: number, last: number, unit: string) => `${unit} ${first}–${last}`,
    words: (count: number) => `${count} từ`,
    stepDue: "Ôn bài đến hạn",
    stepDueBody: (count: number) => (count > 0 ? `${count} từ cũ tới lịch ôn` : "Không còn từ nào đến hạn"),
    stepLearn: "Học thẻ mới",
    stepLearnBody: (done: number, total: number, unit: string) => `${done}/${total} ${unit} đã thuộc`,
    stepTest: "Kiểm tra cuối ngày",
    stepTestBody: (done: number, total: number) => `${done}/${total} từ đã trả lời đúng`,
    stepReview: "Kiểm tra tổng ôn",
    stepReviewBody: (words: number) => `20 câu ngẫu nhiên trong ${words} từ của tuần. Từ sai sẽ quay lại ở lượt ôn ngày mai.`,
    reviewNow: "Ôn ngay",
    study: "Học thẻ",
    test: "Làm bài",
    retest: "Làm lại",
    dayDone: "Đã xong ngày hôm nay",
    dayDoneBody: "Bạn có thể nghỉ, hoặc học trước ngày tiếp theo.",
    allDone: "Bạn đã hoàn thành cả lộ trình!",
    allDoneBody: "Tiếp tục ôn các từ đến hạn để giữ trí nhớ dài hạn.",
    roadmap: "Bản đồ lộ trình",
    legendDone: "Đã xong",
    legendToday: "Hôm nay",
    legendMissed: "Bị lỡ",
    legendTodo: "Chưa tới",
    planned: (date: string) => `Lịch: ${date}`,
    changePlan: "Đổi lộ trình",
    freeStudy: "Học tự do",
  },
  ja: {
    setupTitle: "学習プランを作る",
    setupBody: "単語帳を日ごとに分けます。6日間で新しい語を学び、7日目はまとめ復習。毎日やる範囲がはっきり分かります。",
    paces: ["集中", "標準", "ゆっくり"],
    recommended: "おすすめ",
    custom: "カスタム",
    wordsPerDay: (count: number) => `1日 ${count} 語`,
    paceMeta: (days: number, finish: string) => `${days}日 · ${finish} 完了`,
    start: "プランを始める",
    save: "新しいプランを保存",
    cancel: "キャンセル",
    totalMeta: (words: number, items: number, unit: string) => `${items} ${unit} · ${words} 語`,
    today: "今日",
    ahead: "先取り",
    learnDay: (day: number) => `${day}日目`,
    reviewDay: (week: number) => `第${week}週 まとめ復習`,
    week: (week: number) => `第${week}週`,
    of: (done: number, total: number) => `${done}/${total} 日`,
    finishOn: (date: string) => `${date} 完了予定`,
    onTrack: "予定どおり",
    behind: (days: number) => `${days}日遅れ`,
    aheadBy: (days: number) => `${days}日先行`,
    behindTitle: (days: number) => `プランより ${days} 日遅れています`,
    behindBody: "まとめてやる必要はありません。日程をずらして今日から再開するか、時間のある日に1日分多く進めて追いつきましょう。",
    shift: "日程をずらす",
    range: (first: number, last: number, unit: string) => `${unit} ${first}–${last}`,
    words: (count: number) => `${count} 語`,
    stepDue: "期限の復習",
    stepDueBody: (count: number) => (count > 0 ? `${count} 語が復習日です` : "復習待ちの語はありません"),
    stepLearn: "新しいカード",
    stepLearnBody: (done: number, total: number, unit: string) => `${done}/${total} ${unit} 習得`,
    stepTest: "今日のチェック",
    stepTestBody: (done: number, total: number) => `${done}/${total} 語 正解済み`,
    stepReview: "まとめテスト",
    stepReviewBody: (words: number) => `今週の ${words} 語からランダムに20問。間違えた語は明日の復習に入ります。`,
    reviewNow: "復習する",
    study: "カードで学ぶ",
    test: "テストする",
    retest: "もう一度",
    dayDone: "今日の分は完了です",
    dayDoneBody: "休んでもいいし、次の日を先取りしてもOKです。",
    allDone: "プランをすべて完了しました！",
    allDoneBody: "期限の来た語を復習して、長期記憶に定着させましょう。",
    roadmap: "プラン全体",
    legendDone: "完了",
    legendToday: "今日",
    legendMissed: "未完了",
    legendTodo: "予定",
    planned: (date: string) => `予定日: ${date}`,
    changePlan: "プランを変更",
    freeStudy: "自由に学ぶ",
  },
} as const;

function formatDate(locale: Locale, dateKey: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ja-JP", {
    day: "numeric",
    month: "numeric",
    year: dateKey.slice(0, 4) === todayKey().slice(0, 4) ? undefined : "numeric",
  }).format(new Date(`${dateKey}T00:00:00`));
}

export function VocabularyPlanSetup({
  locale,
  entries,
  phraseBook,
  unit,
  current,
  onSave,
  onCancel,
}: {
  locale: Locale;
  entries: VocabularyBookEntry[];
  phraseBook: boolean;
  unit: string;
  current?: number;
  onSave: (wordsPerDay: number) => void;
  onCancel?: () => void;
}) {
  const copy = planCopy[locale];
  const presets = phraseBook ? [15, 10, 5] : [45, 30, 20];
  const [choice, setChoice] = useState<number | "custom">(
    current === undefined ? presets[1] : presets.includes(current) ? current : "custom",
  );
  const [custom, setCustom] = useState(String(current ?? presets[1]));
  const words = totalWords(entries, phraseBook);
  const wordsPerDay = choice === "custom" ? Math.max(1, Math.min(words, Number(custom) || 1)) : choice;
  const describe = (perDay: number) => {
    const length = buildSchedule(entries, phraseBook, perDay).length;
    return copy.paceMeta(length, formatDate(locale, addDays(todayKey(), length - 1)));
  };

  return (
    <section className="rounded-lg border border-primary/25 bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon name="target" size={20} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold">{copy.setupTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{copy.setupBody}</p>
          <p className="mt-1 text-xs font-bold text-muted">{copy.totalMeta(words, entries.length, unit)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        {presets.map((perDay, index) => (
          <button
            key={perDay}
            type="button"
            onClick={() => setChoice(perDay)}
            className={`focus-ring relative rounded-lg border p-3 text-left transition-colors ${choice === perDay ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-surface"}`}
          >
            {index === 1 && <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">{copy.recommended}</span>}
            <span className="block text-sm font-extrabold text-fg">{copy.paces[index]}</span>
            <span className="mt-1 block text-sm font-bold text-primary">{copy.wordsPerDay(perDay)}</span>
            <span className="mt-0.5 block text-xs text-muted">{describe(perDay)}</span>
          </button>
        ))}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setChoice("custom")}
          onKeyDown={(event) => { if (event.key === "Enter") setChoice("custom"); }}
          className={`focus-ring cursor-pointer rounded-lg border p-3 text-left transition-colors ${choice === "custom" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-surface"}`}
        >
          <span className="block text-sm font-extrabold text-fg">{copy.custom}</span>
          <label className="mt-1 flex items-center gap-1.5 text-sm font-bold text-primary">
            <input
              type="number"
              min={1}
              max={words}
              value={custom}
              onFocus={() => setChoice("custom")}
              onChange={(event) => setCustom(event.target.value)}
              className="focus-ring h-8 w-16 rounded-md border border-border bg-bg px-2 text-sm text-fg"
            />
            {locale === "vi" ? "từ/ngày" : "語/日"}
          </label>
          {choice === "custom" && <span className="mt-0.5 block text-xs text-muted">{describe(wordsPerDay)}</span>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>{copy.cancel}</Button>}
        <Button onClick={() => onSave(wordsPerDay)}>
          <Icon name="play" size={16} />
          {current === undefined ? copy.start : copy.save}
        </Button>
      </div>
    </section>
  );
}

type ItemState = "done" | "current" | "missed" | "todo";

export function VocabularyPlanBoard({
  locale,
  entries,
  phraseBook,
  unit,
  plan,
  items,
  progress,
  passedKeys,
  learnedEntries,
  dueCount,
  onShift,
  onEdit,
  onStudy,
  onTest,
  onReviewDue,
}: {
  locale: Locale;
  entries: VocabularyBookEntry[];
  phraseBook: boolean;
  unit: string;
  plan: VocabularyBookPlan;
  items: PlanItem[];
  progress: PlanProgress;
  passedKeys: Set<string>;
  learnedEntries: Map<string, boolean>;
  dueCount: number;
  onShift: () => void;
  onEdit: () => void;
  onStudy: (item: PlanItem) => void;
  onTest: (item: PlanItem) => void;
  onReviewDue: () => void;
}) {
  const copy = planCopy[locale];
  const [selected, setSelected] = useState<number | null>(null);
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const learnDays = items.filter((item) => item.kind === "learn").length;
  const current = items[progress.currentIndex];
  const plannedDate = (index: number) => addDays(plan.start_date, index);
  // Behind schedule: one item a day from today. Otherwise the calendar holds.
  const finishDate =
    progress.behind > 0
      ? addDays(todayKey(), Math.max(0, items.length - progress.currentIndex - 1))
      : plannedDate(items.length - 1);

  const stateOf = (index: number): ItemState =>
    progress.done[index]
      ? "done"
      : index === progress.currentIndex
        ? "current"
        : index < progress.scheduledIndex
          ? "missed"
          : "todo";

  const itemStats = (item: PlanItem) => {
    const itemEntries = item.entryIds.map((id) => byId.get(id)).filter(Boolean) as VocabularyBookEntry[];
    const keys = itemEntries.flatMap((entry) => entryWordKeys(entry, phraseBook));
    return {
      entries: itemEntries,
      learned: itemEntries.filter((entry) => learnedEntries.get(entry.id)).length,
      passed: keys.filter((key) => passedKeys.has(key)).length,
      words: keys.length,
    };
  };

  const statusPill =
    progress.finished
      ? null
      : progress.behind > 0
        ? <span className="rounded-full bg-[var(--warning-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--warning)]">{copy.behind(progress.behind)}</span>
        : progress.behind < 0
          ? <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--success)]">{copy.aheadBy(-progress.behind)}</span>
          : <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--success)]">{copy.onTrack}</span>;

  const detail = selected !== null ? items[selected] : null;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold tabular-nums text-fg">{copy.of(progress.completed, items.length)}</span>
            {statusPill}
          </div>
          <span className="text-xs font-bold text-muted">{copy.finishOn(formatDate(locale, finishDate))}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(progress.completed / Math.max(1, items.length)) * 100}%` }} />
        </div>

        {progress.behind > 0 && !progress.finished && (
          <div className="mt-4 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-4">
            <p className="text-sm font-extrabold text-fg">{copy.behindTitle(progress.behind)}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{copy.behindBody}</p>
            <Button size="sm" variant="outline" className="mt-3 bg-card" onClick={onShift}>
              <Icon name="arrow-right" size={15} />
              {copy.shift}
            </Button>
          </div>
        )}

        {progress.finished || !current ? (
          <div className="mt-5 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><Icon name="trophy" size={20} /></span>
            <div>
              <h2 className="text-lg font-extrabold">{copy.allDone}</h2>
              <p className="mt-1 text-sm text-muted">{copy.allDoneBody}</p>
              {dueCount > 0 && <Button size="sm" className="mt-3" onClick={onReviewDue}><Icon name="retry" size={15} />{copy.reviewNow} · {dueCount}</Button>}
            </div>
          </div>
        ) : (
          <TodayCard
            locale={locale}
            phraseBook={phraseBook}
            unit={unit}
            item={current}
            heading={progress.currentIndex > progress.scheduledIndex ? copy.ahead : copy.today}
            doneToday={progress.currentIndex > progress.scheduledIndex}
            stats={itemStats(current)}
            dueCount={dueCount}
            onStudy={() => onStudy(current)}
            onTest={() => onTest(current)}
            onReviewDue={onReviewDue}
          />
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-muted">{copy.roadmap} · {copy.learnDay(learnDays)}</h2>
          <button type="button" onClick={onEdit} className="focus-ring rounded-md text-xs font-bold text-primary hover:underline">{copy.changePlan}</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-muted">
          <Legend className="bg-[var(--success)]" label={copy.legendDone} />
          <Legend className="bg-primary ring-2 ring-primary/30" label={copy.legendToday} />
          <Legend className="bg-[var(--warning)]" label={copy.legendMissed} />
          <Legend className="border border-border bg-surface" label={copy.legendTodo} />
        </div>
        <div className="mt-4 space-y-1.5">
          {Array.from({ length: Math.ceil(items.length / (LEARN_DAYS_PER_WEEK + 1)) }, (_, week) => {
            const weekItems = items.slice(week * (LEARN_DAYS_PER_WEEK + 1), (week + 1) * (LEARN_DAYS_PER_WEEK + 1));
            return (
              <div key={week} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-[11px] font-bold text-muted">{copy.week(week + 1)}</span>
                <div className="grid flex-1 grid-cols-7 gap-1.5">
                  {weekItems.map((item) => {
                    const state = stateOf(item.index);
                    const tone =
                      state === "done"
                        ? "bg-[var(--success)] text-white"
                        : state === "current"
                          ? "bg-primary text-white ring-2 ring-primary/30"
                          : state === "missed"
                            ? "bg-[var(--warning)] text-white"
                            : "border border-border bg-surface text-muted";
                    return (
                      <button
                        key={item.index}
                        type="button"
                        onClick={() => setSelected(selected === item.index ? null : item.index)}
                        title={`${item.kind === "learn" ? copy.learnDay(item.day) : copy.reviewDay(item.week)} · ${formatDate(locale, plannedDate(item.index))}`}
                        className={`focus-ring grid h-8 place-items-center rounded-md text-[11px] font-extrabold tabular-nums transition-transform hover:scale-105 ${tone} ${selected === item.index ? "outline outline-2 outline-offset-2 outline-fg/40" : ""}`}
                      >
                        {item.kind === "learn" ? item.day : <Icon name="retry" size={13} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {detail && (() => {
          const stats = itemStats(detail);
          return (
            <div className="mt-4 rounded-lg border border-border bg-surface/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-extrabold">{detail.kind === "learn" ? copy.learnDay(detail.day) : copy.reviewDay(detail.week)}</h3>
                <span className="text-xs font-bold text-muted">{copy.planned(formatDate(locale, plannedDate(detail.index)))}</span>
              </div>
              <p className="mt-1 text-xs font-bold text-muted">
                {copy.range(detail.firstOrder, detail.lastOrder, unit)} · {copy.words(stats.words)}
                {detail.kind === "learn" && ` · ${copy.stepTestBody(stats.passed, stats.words)}`}
              </p>
              <EntryChips entries={stats.entries} phraseBook={phraseBook} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => onStudy(detail)}><Icon name="book" size={15} />{copy.study}</Button>
                <Button size="sm" variant="outline" onClick={() => onTest(detail)}><Icon name="trophy" size={15} />{progress.done[detail.index] ? copy.retest : copy.test}</Button>
              </div>
            </div>
          );
        })()}
      </section>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-[3px] ${className}`} />
      {label}
    </span>
  );
}

function EntryChips({ entries, phraseBook }: { entries: VocabularyBookEntry[]; phraseBook: boolean }) {
  if (phraseBook) {
    return (
      <ul className="mt-3 space-y-1">
        {entries.map((entry) => (
          <li key={entry.id} lang="ja" className="truncate text-sm font-semibold text-fg">{entry.kanji}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {entries.map((entry) => (
        <span key={entry.id} lang="ja" title={entry.meaning} className="grid h-10 min-w-10 place-items-center rounded-md border border-border bg-card px-1.5 text-xl font-bold text-fg">
          {entry.kanji}
        </span>
      ))}
    </div>
  );
}

function TodayCard({
  locale,
  phraseBook,
  unit,
  item,
  heading,
  doneToday,
  stats,
  dueCount,
  onStudy,
  onTest,
  onReviewDue,
}: {
  locale: Locale;
  phraseBook: boolean;
  unit: string;
  item: PlanItem;
  heading: string;
  doneToday: boolean;
  stats: { entries: VocabularyBookEntry[]; learned: number; passed: number; words: number };
  dueCount: number;
  onStudy: () => void;
  onTest: () => void;
  onReviewDue: () => void;
}) {
  const copy = planCopy[locale];
  const steps =
    item.kind === "learn"
      ? [
          { icon: "retry" as const, title: copy.stepDue, body: copy.stepDueBody(dueCount), done: dueCount === 0, action: dueCount > 0 ? { label: copy.reviewNow, run: onReviewDue } : null },
          { icon: "book" as const, title: copy.stepLearn, body: copy.stepLearnBody(stats.learned, stats.entries.length, unit), done: stats.entries.length > 0 && stats.learned === stats.entries.length, action: { label: copy.study, run: onStudy } },
          { icon: "trophy" as const, title: copy.stepTest, body: copy.stepTestBody(stats.passed, stats.words), done: stats.words > 0 && stats.passed === stats.words, action: { label: copy.test, run: onTest } },
        ]
      : [
          { icon: "retry" as const, title: copy.stepDue, body: copy.stepDueBody(dueCount), done: dueCount === 0, action: dueCount > 0 ? { label: copy.reviewNow, run: onReviewDue } : null },
          { icon: "trophy" as const, title: copy.stepReview, body: copy.stepReviewBody(item.wordCount), done: false, action: { label: copy.test, run: onTest } },
        ];
  const nextStep = steps.findIndex((step) => !step.done && step.action);

  return (
    <div className="mt-5">
      {doneToday && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm font-bold text-[var(--success)]">
          <Icon name="check" size={16} />
          {copy.dayDone} — <span className="font-semibold">{copy.dayDoneBody}</span>
        </div>
      )}
      <p className="text-xs font-extrabold uppercase tracking-wide text-primary">{heading}</p>
      <h2 className="mt-1 text-xl font-extrabold">
        {item.kind === "learn" ? copy.learnDay(item.day) : copy.reviewDay(item.week)}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {copy.range(item.firstOrder, item.lastOrder, unit)} · {copy.words(stats.words)}
      </p>
      {item.kind === "learn" && <EntryChips entries={stats.entries} phraseBook={phraseBook} />}
      <ol className="mt-5 space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`flex items-center gap-3 rounded-lg border p-3 ${index === nextStep ? "border-primary/35 bg-primary/5" : "border-border"}`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${step.done ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-surface text-muted"}`}>
              <Icon name={step.done ? "check" : step.icon} size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-fg">{index + 1}. {step.title}</span>
              <span className="block text-xs leading-5 text-muted">{step.body}</span>
            </span>
            {step.action && (
              <Button size="sm" variant={index === nextStep ? "primary" : "outline"} onClick={step.action.run} className="shrink-0">
                {step.action.label}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
