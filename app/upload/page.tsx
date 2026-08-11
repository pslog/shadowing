"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { AdminOnlyNotice } from "@/components/lesson/AdminOnlyNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FullScreenLoading } from "@/components/ui/loading";
import { Icon } from "@/components/ui/icon";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import { isAdminProfile } from "@/lib/store/selectors";
import { useI18n } from "@/components/i18n/useI18n";

type Platform = "youtube" | "tiktok" | "facebook";
type UploadStatus = "success" | "error" | "not_configured";
type Privacy = "private" | "unlisted" | "public";

interface UploadResult {
  platform: Platform;
  status: UploadStatus;
  message: string;
  id?: string;
  url?: string;
}

const platformLabel: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

const statusTone: Record<UploadStatus, "success" | "danger" | "warning"> = {
  success: "success",
  error: "danger",
  not_configured: "warning",
};

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadPage() {
  const { profile, ready } = useRequireProfile();
  const { dictionary, href } = useI18n();
  const t = dictionary.upload;
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("private");
  const [platforms, setPlatforms] = useState<Platform[]>(["youtube"]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

  const canSubmit = useMemo(
    () => Boolean(file && title.trim() && platforms.length > 0 && !uploading),
    [file, platforms.length, title, uploading],
  );

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdminProfile(profile)) return <AdminOnlyNotice />;

  function togglePlatform(platform: Platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  async function uploadVideo() {
    if (!file) {
      setError(t.errorNoFile);
      return;
    }
    if (!title.trim()) {
      setError(t.errorNoTitle);
      return;
    }
    if (platforms.length === 0) {
      setError(t.errorNoPlatform);
      return;
    }

    setUploading(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      formData.set("video", file);
      formData.set("title", title.trim());
      formData.set("description", description.trim());
      formData.set("privacy", privacy);
      for (const platform of platforms) formData.append("platforms", platform);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        results?: UploadResult[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? t.errorFailed);
      }

      setResults(payload.results ?? []);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t.errorFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={href("/")} className="text-sm text-muted hover:text-fg">
            {t.backToDashboard}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{t.title}</h1>
          <p className="max-w-3xl text-muted">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{t.platformCount(platforms.length)}</Badge>
          {file && <Badge tone="neutral">{formatBytes(file.size)}</Badge>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card>
          <CardTitle>{t.videoCard}</CardTitle>
          <label className="mt-4 grid min-h-64 cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-surface/60 p-5 text-center transition hover:border-primary/50">
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                if (nextFile && !title.trim()) {
                  setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                className="max-h-[28rem] w-full rounded-lg bg-black"
              />
            ) : (
              <div>
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon name="plus" size={20} />
                </div>
                <p className="font-semibold">{t.pickFile}</p>
                <p className="mt-1 text-sm text-muted">{t.pickFileHint}</p>
              </div>
            )}
          </label>
          {file && (
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-surface/60 p-3 text-sm sm:grid-cols-3">
              <div className="min-w-0 sm:col-span-2">
                <p className="truncate font-semibold">{file.name}</p>
                <p className="text-muted">{file.type || "video/*"}</p>
              </div>
              <p className="font-semibold text-muted sm:text-right">{formatBytes(file.size)}</p>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>{t.settings}</CardTitle>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-sm font-semibold" htmlFor="upload-title">
                {t.titleLabel}
              </label>
              <input
                id="upload-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="focus-ring mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none"
                placeholder={t.titlePlaceholder}
              />
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="upload-description">
                {t.descriptionLabel}
              </label>
              <textarea
                id="upload-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="focus-ring mt-2 min-h-28 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none"
                placeholder={t.descriptionPlaceholder}
              />
            </div>

            <div>
              <p className="text-sm font-semibold">{t.platformsLabel}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {(["youtube", "tiktok", "facebook"] as const).map((platform) => (
                  <label
                    key={platform}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 text-sm font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={platforms.includes(platform)}
                      onChange={() => togglePlatform(platform)}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {platformLabel[platform]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold">{t.privacyLabel}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["private", "unlisted", "public"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={privacy === option ? "primary" : "outline"}
                    onClick={() => setPrivacy(option)}
                  >
                    {option === "private"
                      ? t.privacyPrivate
                      : option === "unlisted"
                        ? t.privacyUnlisted
                        : t.privacyPublic}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">{t.privacyHint}</p>
            </div>

            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              onClick={() => void uploadVideo()}
              disabled={!canSubmit}
              className="w-full"
            >
              <Icon name="save" size={18} />
              {uploading ? t.uploading : t.submit}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardTitle>{t.resultsTitle}</CardTitle>
        {results.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted">
            {t.resultsEmpty}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {results.map((result) => (
              <div
                key={result.platform}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{platformLabel[result.platform]}</p>
                    <Badge tone={statusTone[result.status]}>
                      {result.status === "success"
                        ? t.statusSuccess
                        : result.status === "not_configured"
                          ? t.statusNotConfigured
                          : t.statusError}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{result.message}</p>
                  {result.id && (
                    <p className="mt-1 font-mono text-xs text-muted">ID: {result.id}</p>
                  )}
                </div>
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold hover:bg-card"
                  >
                    {t.openVideo}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
