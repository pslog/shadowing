"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { AdminOnlyNotice } from "@/components/lesson/AdminOnlyNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FullScreenLoading } from "@/components/ui/loading";
import { Avatar } from "@/components/ui/avatar";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { useData } from "@/lib/store/DataProvider";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import {
  ADMIN_EMAIL,
  isAdminProfile,
  isSuperAdminEmail,
  isSuperAdminProfile,
} from "@/lib/store/selectors";
import type { UserRole } from "@/lib/types";

interface ManagedUser {
  id: string;
  email: string | null;
  role: UserRole;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number | null;
  current_level: number | null;
  current_streak: number | null;
  created_at: string;
}

const ROLE_LABEL: Record<UserRole, string> = {
  user: "一般",
  admin: "管理者",
};

export default function AdminUsersPage() {
  const { profile, ready } = useRequireProfile();
  const { usingSupabase } = useData();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canView = isAdminProfile(profile);
  const canChangeRoles = isSuperAdminProfile(profile);

  const loadUsers = useCallback(async () => {
    if (!usingSupabase || !canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("profiles")
      .select(
        "id,email,role,display_name,avatar_url,total_xp,current_level,current_streak,created_at",
      )
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setUsers([]);
    } else {
      setUsers((data ?? []) as ManagedUser[]);
    }
    setLoading(false);
  }, [canView, usingSupabase]);

  useEffect(() => {
    if (ready) void loadUsers();
  }, [loadUsers, ready]);

  const counts = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.role === "admin").length,
    }),
    [users],
  );

  async function updateRole(user: ManagedUser, role: UserRole) {
    if (!canChangeRoles || user.role === role || isSuperAdminEmail(user.email)) return;

    setSavingId(user.id);
    setError(null);
    const supabase = createSupabaseClient();
    const { error: updateError } =
      (await supabase
        ?.from("profiles")
        .update({ role })
        .eq("id", user.id)) ?? {};

    if (updateError) {
      setError(updateError.message);
    } else {
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, role } : item)),
      );
    }
    setSavingId(null);
  }

  if (!ready || !profile) return <FullScreenLoading />;
  if (!canView) return <AdminOnlyNotice />;

  return (
    <AppShell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-muted hover:text-fg">
            ダッシュボードへ
          </Link>
          <h1 className="mt-1 text-2xl font-bold">ユーザー管理</h1>
          <p className="text-muted">
            ユーザー一覧を確認し、コース・レッスン編集権限を付与できます。
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone="primary">{counts.total}人</Badge>
          <Badge tone="warning">管理者 {counts.admins}人</Badge>
        </div>
      </div>

      {!usingSupabase && (
        <Card className="mb-4">
          <CardTitle>Supabaseが必要です</CardTitle>
          <p className="mt-2 text-sm text-muted">
            ユーザー管理にはSupabase Authとprofilesテーブルが必要です。
          </p>
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <CardTitle>プロフィール一覧</CardTitle>
          {!canChangeRoles && (
            <p className="mt-1 text-sm text-muted">
              権限を変更できるのは {ADMIN_EMAIL} のみです。
            </p>
          )}
        </div>

        {loading ? (
          <div className="p-5 text-sm text-muted">ユーザーを読み込み中...</div>
        ) : users.length === 0 ? (
          <div className="p-5 text-sm text-muted">ユーザーが見つかりません。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-surface/70 text-xs uppercase text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">ユーザー</th>
                  <th className="px-5 py-3 font-semibold">権限</th>
                  <th className="px-5 py-3 font-semibold">学習状況</th>
                  <th className="px-5 py-3 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const superAdmin = isSuperAdminEmail(user.email);
                  const nextRole: UserRole = user.role === "admin" ? "user" : "admin";
                  const saving = savingId === user.id;
                  return (
                    <tr key={user.id} className="align-middle">
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar
                            src={user.avatar_url}
                            name={user.display_name || user.email}
                            className="h-10 w-10 rounded-full font-bold"
                            fallbackClassName="bg-surface text-primary"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {user.display_name || user.email || "名前なし"}
                            </p>
                            <p className="truncate text-xs text-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Badge tone={user.role === "admin" ? "warning" : "neutral"}>
                            {superAdmin ? "最高管理者" : ROLE_LABEL[user.role]}
                          </Badge>
                          {superAdmin && (
                            <span className="text-xs text-muted">固定</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted">
                        Lv.{user.current_level ?? 1} · {user.total_xp ?? 0} XP ·{" "}
                        {user.current_streak ?? 0} streak
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          type="button"
                          variant={nextRole === "admin" ? "primary" : "outline"}
                          size="sm"
                          disabled={!canChangeRoles || superAdmin || saving}
                          onClick={() => updateRole(user, nextRole)}
                        >
                          {saving
                            ? "保存中..."
                            : nextRole === "admin"
                              ? "管理者にする"
                              : "一般に戻す"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
