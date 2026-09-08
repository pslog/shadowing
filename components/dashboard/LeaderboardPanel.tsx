"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/useI18n";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

interface LeaderboardUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  totalXp: number;
  level: number;
  streak: number;
  passed: number;
}

interface LeaderboardPayload {
  topXp: LeaderboardUser[];
}

const MEDAL: Record<number, { bg: string; fg: string }> = {
  0: { bg: "linear-gradient(140deg, #fbe3a1 0%, #eab308 100%)", fg: "#7a4d05" },
  1: { bg: "linear-gradient(140deg, #eef2f7 0%, #b6c0cd 100%)", fg: "#495768" },
  2: { bg: "linear-gradient(140deg, #f0d0af 0%, #c9884f 100%)", fg: "#653414" },
};

export function LeaderboardPanel({ currentUserId }: { currentUserId: string | null }) {
  const { localeTag, dictionary } = useI18n();
  const t = dictionary.progress;
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: LeaderboardPayload | null) => {
        if (!cancelled) {
          setUsers(data?.topXp ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">{t.leaderboardTitle}</CardTitle>
          <p className="mt-1 text-xs leading-5 text-muted">{t.leaderboardBody}</p>
        </div>
        <Icon name="trending" size={20} className="shrink-0 text-accent" />
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-label={dictionary.common.loading}>
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex animate-pulse items-center gap-2.5 rounded-xl border border-border bg-surface/60 px-3 py-2.5">
              <span className="h-8 w-8 rounded-lg bg-primary/10" />
              <span className="h-9 w-9 rounded-lg bg-primary/10" />
              <span className="h-3 flex-1 rounded bg-primary/10" />
              <span className="h-3 w-12 rounded bg-primary/10" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface p-4">
          <p className="text-sm font-bold">{t.leaderboardEmptyTitle}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{t.leaderboardEmptyBody}</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-2">
          {users.slice(0, 3).map((user, index) => {
            const rank = index + 1;
            const isMe = user.id === currentUserId;
            const medal = MEDAL[index];
            return (
              <li
                key={user.id}
                className={[
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                  rank === 1
                    ? "border-[var(--c-amber)]/35 bg-[var(--c-amber)]/10"
                    : isMe
                      ? "border-primary/30 bg-primary/[0.06]"
                      : "border-border bg-surface/60",
                ].join(" ")}
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black tabular-nums"
                  style={medal ? { background: medal.bg, color: medal.fg } : undefined}
                >
                  {rank}
                </span>
                <Avatar
                  src={user.avatarUrl}
                  name={user.displayName}
                  className="h-9 w-9 rounded-lg text-xs"
                  fallbackClassName="bg-primary/10 text-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                    <span className="truncate">{user.displayName}</span>
                    {isMe && (
                      <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {t.you}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Lv.{user.level} · {user.passed}{t.passSuffix}
                    {user.streak > 0 && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-[var(--warning)]">
                        <Icon name="flame" size={10} filled />
                        {user.streak}
                      </span>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-black tabular-nums">
                  {user.totalXp.toLocaleString(localeTag)}
                  <span className="ml-0.5 text-[9px] text-muted">XP</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
