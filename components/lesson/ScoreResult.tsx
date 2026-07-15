import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { almostFeedback } from "@/lib/scoring/feedback";
import type { ScoreBreakdown } from "@/lib/types";

function ScoreRing({ value, passed }: { value: number; passed: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  const from = passed ? "var(--c-emerald)" : "var(--c-amber)";
  const to = passed ? "var(--success)" : "var(--accent)";
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="animate-pop shrink-0">
      <defs>
        <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <circle
        cx="52"
        cy="52"
        r={r}
        fill="none"
        stroke="color-mix(in srgb, var(--muted) 20%, transparent)"
        strokeWidth="9"
      />
      <circle
        cx="52"
        cy="52"
        r={r}
        fill="none"
        stroke="url(#scoreGrad)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 52 52)"
        style={{ transition: "stroke-dasharray 0.7s ease" }}
      />
      <text
        x="52"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-fg font-extrabold"
        style={{ fontSize: "28px" }}
      >
        {value}
      </text>
    </svg>
  );
}

function Dim({
  label,
  value,
  hue,
  note,
}: {
  label: string;
  value: number | null;
  hue: string;
  note?: string;
}) {
  const measured = value != null;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums">
          {measured ? value : note ?? "—"}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_20%,transparent)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${measured ? value : 0}%`, background: hue }}
        />
      </div>
    </div>
  );
}

export function ScoreResult({
  score,
  passScore,
  improvement,
}: {
  score: ScoreBreakdown;
  passScore: number;
  improvement?: number | null;
}) {
  const passed = score.passed;
  return (
    <div className="card p-6">
      <div className="flex items-center gap-5">
        <ScoreRing value={score.total} passed={passed} />
        <div className="min-w-0">
          {passed ? (
            <Badge tone="success">
              <Icon name="check" size={13} strokeWidth={2.5} />
              Pass
            </Badge>
          ) : (
            <Badge tone="warning">もう少し</Badge>
          )}
          {typeof improvement === "number" && improvement > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-[var(--success)]">
              <Icon name="trending" size={15} />前回より+{improvement}点
            </p>
          )}
          <p className={cn("mt-1.5 text-sm", !passed && "text-muted")}>
            {score.feedback}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        <Dim label="発音" value={score.pronunciation} hue="var(--c-indigo)" />
        <Dim label="網羅" value={score.coverage} hue="var(--c-emerald)" />
        <Dim label="速度" value={score.speed} hue="var(--c-sky)" />
      </div>
      <div className="mt-4">
        <Dim
          label="イントネーション"
          value={score.intonation}
          hue="var(--c-violet)"
          note="未計測"
        />
      </div>

      {!passed && (
        <p className="mt-4 rounded-xl bg-[var(--warning-soft)] px-4 py-2.5 text-sm text-[var(--warning)]">
          {almostFeedback(score.total, passScore)}
        </p>
      )}
    </div>
  );
}
