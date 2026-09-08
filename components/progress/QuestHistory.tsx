"use client";

// The retrospective half of the quest board.
//
// The board on the dashboard answers "what is left today"; this answers "have I
// been showing up, and at what". Same rows, different question — which is why
// the two pages can both show quest data without repeating each other.
//
// Drawn as small multiples: one track per quest, each with its own label and
// its own count. The first version stacked all three quests into a single
// column per day, and thirty of those columns read as a barcode — you could not
// tell which skill the gaps belonged to, which is the only thing this card
// exists to say. Three separate tracks answer it at a glance, and the fourth
// track marks the days that earned the all-three bonus (as a single 1px line
// under a stacked column, those were effectively invisible).

import { useI18n } from "@/components/i18n/useI18n";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { QUEST_IDS, type QuestId } from "@/lib/gamification/quests";
import type { QuestDayStat } from "@/lib/store/selectors";

const TONE: Record<QuestId, string> = {
  shadowing: "var(--c-emerald)",
  reading: "var(--c-sky)",
  vocab: "var(--c-amber)",
};

const EMPTY = "color-mix(in srgb, var(--muted) 13%, transparent)";

function shortDate(date: string, localeTag: string): string {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString(localeTag, {
    month: "short",
    day: "numeric",
  });
}

function Track({
  label,
  tone,
  cells,
  count,
  total,
  tall,
}: {
  label: string;
  tone: string;
  /** One entry per day, oldest first. */
  cells: { date: string; on: boolean; title: string }[];
  count: number;
  total: number;
  tall?: boolean;
}) {
  const { dictionary: m } = useI18n();
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-bold text-fg">
        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tone }} />
        <span className="truncate">{label}</span>
      </span>
      <div className="flex min-w-0 flex-1 gap-[3px]">
        {cells.map((cell) => (
          <span
            key={cell.date}
            title={cell.title}
            className={`flex-1 rounded-[3px] ${tall ? "h-4" : "h-3"}`}
            style={{ background: cell.on ? tone : EMPTY }}
          />
        ))}
      </div>
      <span className="w-20 shrink-0 whitespace-nowrap text-right text-xs font-bold tabular-nums text-muted">
        {m.questHistory.questDays(count, total)}
      </span>
    </div>
  );
}

export function QuestHistory({ history }: { history: QuestDayStat[] }) {
  const { localeTag, dictionary: m } = useI18n();
  const t = m.questHistory;
  const q = m.quests;

  const perfectDays = history.filter((day) => day.perfect).length;
  const activeDays = history.filter((day) => day.cleared > 0).length;

  const label: Record<QuestId, string> = {
    shadowing: q.shadowingTitle,
    reading: q.readingTitle,
    vocab: q.vocabTitle,
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{t.title}</CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted">
            {activeDays > 0 ? t.summary(activeDays, history.length) : t.empty}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold"
          style={{
            color: perfectDays > 0 ? "var(--c-violet)" : "var(--muted)",
            background:
              perfectDays > 0
                ? "color-mix(in srgb, var(--c-violet) 12%, transparent)"
                : "var(--surface)",
          }}
        >
          <Icon name="trophy" size={15} filled={perfectDays > 0} />
          {t.perfectDays(perfectDays)}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {QUEST_IDS.map((id) => (
          <Track
            key={id}
            label={label[id]}
            tone={TONE[id]}
            count={history.filter((day) => day.done[id]).length}
            total={history.length}
            cells={history.map((day) => ({
              date: day.date,
              on: day.done[id],
              title: `${shortDate(day.date, localeTag)} · ${label[id]}`,
            }))}
          />
        ))}

        <div className="mt-1 border-t border-border pt-2">
          <Track
            label={t.bonusTrack}
            tone="var(--c-violet)"
            count={perfectDays}
            total={history.length}
            tall
            cells={history.map((day) => ({
              date: day.date,
              on: day.perfect,
              title: t.dayTooltip(
                shortDate(day.date, localeTag),
                day.cleared,
                QUEST_IDS.length,
              ),
            }))}
          />
        </div>
      </div>

      <div className="mt-2 flex justify-between pl-[6.75rem] text-[11px] font-semibold text-muted">
        <span>{shortDate(history[0]?.date ?? "", localeTag)}</span>
        <span className="pr-20">{t.today}</span>
      </div>
    </Card>
  );
}
