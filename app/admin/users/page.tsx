"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminConsoleShell } from "@/components/admin/AdminConsoleShell";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
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
import { useI18n } from "@/components/i18n/useI18n";

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

export default function AdminUsersPage() {
  const { profile, ready } = useRequireProfile();
  const { usingSupabase } = useData();
  const { dictionary } = useI18n();
  const t = dictionary.adminUsers;
  const roleLabel: Record<UserRole, string> = {
    user: t.roleUser,
    admin: t.roleAdmin,
  };
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Row whose full learning profile is open. */
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const canView = isAdminProfile(profile);
  const canChangeRoles = isSuperAdminProfile(profile);

  const loadUsers = useCallback(async () => {
    if (!usingSupabase || !canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = await createSupabaseClient();
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
    const supabase = await createSupabaseClient();
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
    <AdminConsoleShell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="primary">{t.countUsers(counts.total)}</Badge>
          <Badge tone="warning">{t.countAdmins(counts.admins)}</Badge>
        </div>
      </div>

      {!usingSupabase && (
        <Card className="mb-4">
          <CardTitle>{t.supabaseTitle}</CardTitle>
          <p className="mt-2 text-sm text-muted">{t.supabaseBody}</p>
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <CardTitle>{t.listTitle}</CardTitle>
          {!canChangeRoles && (
            <p className="mt-1 text-sm text-muted">{t.onlySuperAdmin(ADMIN_EMAIL)}</p>
          )}
        </div>

        {loading ? (
          <div className="p-5 text-sm text-muted">{t.loading}</div>
        ) : users.length === 0 ? (
          <div className="p-5 text-sm text-muted">{t.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-surface/70 text-xs uppercase text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t.colUser}</th>
                  <th className="px-5 py-3 font-semibold">{t.colRole}</th>
                  <th className="px-5 py-3 font-semibold">{t.colStatus}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t.colAction}</th>
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
                            <button
                              type="button"
                              onClick={() => setDetailUserId(user.id)}
                              className="focus-ring truncate rounded font-semibold hover:text-primary hover:underline"
                            >
                              {user.display_name || user.email || t.noName}
                            </button>
                            <p className="truncate text-xs text-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Badge tone={user.role === "admin" ? "warning" : "neutral"}>
                            {superAdmin ? t.roleSuperAdmin : roleLabel[user.role]}
                          </Badge>
                          {superAdmin && (
                            <span className="text-xs text-muted">{t.fixed}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted">
                        Lv.{user.current_level ?? 1} · {user.total_xp ?? 0} XP ·{" "}
                        {user.current_streak ?? 0} streak
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setDetailUserId(user.id)}
                        >
                          {t.viewDetail}
                        </Button>
                        <Button
                          type="button"
                          variant={nextRole === "admin" ? "primary" : "outline"}
                          size="sm"
                          disabled={!canChangeRoles || superAdmin || saving}
                          onClick={() => updateRole(user, nextRole)}
                        >
                          {saving
                            ? t.saving
                            : nextRole === "admin"
                              ? t.makeAdmin
                              : t.makeUser}
                        </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detailUserId && (
        <UserDetailDialog
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
        />
      )}
    </AdminConsoleShell>
  );
}
