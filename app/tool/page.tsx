"use client";

import { useMemo, useState } from "react";
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

type Platform = "youtube" | "tiktok" | "facebook";

interface SourceVideo {
  id: string;
  platform: Platform;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
}

type LayoutMode = "compact" | "wide";
type LoadState = "idle" | "loading" | "loaded" | "error";

const platformLabel: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function embedUrlFor(video: SourceVideo) {
  if (video.platform === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1&rel=0`;
  }
  if (video.platform === "tiktok") {
    return `https://www.tiktok.com/player/v1/${video.id}`;
  }
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    video.url,
  )}&show_text=false`;
}

function formatPublished(value: string | null) {
  if (!value) return "Chưa có ngày";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function wallClasses(mode: LayoutMode) {
  if (mode === "wide") return "grid gap-4 lg:grid-cols-2";
  return "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
}

function videoKey(video: SourceVideo) {
  return `${video.platform}:${video.id}`;
}

export default function ToolPage() {
  const { profile, ready } = useRequireProfile();
  const [rawUrl, setRawUrl] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [videos, setVideos] = useState<SourceVideo[]>([]);
  const [loadedVideoKeys, setLoadedVideoKeys] = useState<string[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("compact");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const loadedCount = useMemo(
    () => videos.filter((video) => loadedVideoKeys.includes(videoKey(video))).length,
    [loadedVideoKeys, videos],
  );
  const platforms = useMemo(
    () => [...new Set(videos.map((video) => video.platform))],
    [videos],
  );

  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdminProfile(profile)) return <AdminOnlyNotice />;

  async function loadSourceVideos() {
    const nextUrl = normalizeUrl(rawUrl);
    if (!nextUrl) {
      setError("Nhập link channel/profile/page trước.");
      return;
    }

    setSubmittedUrl(nextUrl);
    setVideos([]);
    setLoadedVideoKeys([]);
    setError(null);
    setLoadState("loading");

    try {
      const response = await fetch(
        `/api/tool/channel-videos?url=${encodeURIComponent(nextUrl)}`,
      );
      const payload = (await response.json()) as {
        videos?: SourceVideo[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Không tải được danh sách video.");
      }

      const nextVideos = payload.videos ?? [];
      setVideos(nextVideos);
      setLoadState("loaded");
      if (nextVideos.length === 0) {
        setError(
          "Không tìm thấy video public nào. TikTok/Facebook có thể chặn profile riêng tư hoặc nội dung cần đăng nhập.",
        );
      }
    } catch (loadError) {
      setLoadState("error");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được danh sách video.",
      );
    }
  }

  function loadPlayer(video: SourceVideo) {
    const key = videoKey(video);
    setLoadedVideoKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }

  function loadAllPlayers() {
    setLoadedVideoKeys(videos.map(videoKey));
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-muted hover:text-fg">
            Về dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Tool kiểm tra video channel</h1>
          <p className="max-w-3xl text-muted">
            Dán link YouTube channel, TikTok profile hoặc Facebook page để tải video
            public và mở player trực tiếp trên page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{videos.length} video</Badge>
          <Badge tone="neutral">{loadedCount} player đã tải</Badge>
          {platforms.map((platform) => (
            <Badge key={platform} tone="neutral">
              {platformLabel[platform]}
            </Badge>
          ))}
        </div>
      </div>

      <Card className="mb-5">
        <CardTitle>Link nguồn</CardTitle>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={rawUrl}
            onChange={(event) => setRawUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadSourceVideos();
            }}
            placeholder="youtube.com/@channel | tiktok.com/@user | facebook.com/page"
            className="focus-ring h-11 w-full rounded-xl border border-border bg-surface px-3 font-mono text-sm outline-none"
          />
          <Button
            type="button"
            onClick={() => void loadSourceVideos()}
            disabled={loadState === "loading"}
          >
            <Icon name="play" size={16} />
            {loadState === "loading" ? "Đang tải..." : "Tải video"}
          </Button>
        </div>
        {error && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={loadAllPlayers}
            disabled={videos.length === 0 || loadedCount === videos.length}
          >
            <Icon name="play" size={16} />
            Tải toàn bộ player
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {(["compact", "wide"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={layoutMode === mode ? "primary" : "outline"}
                onClick={() => setLayoutMode(mode)}
              >
                {mode === "compact" ? "Lưới" : "Rộng"}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted">
            Player được lazy-load để page nhẹ hơn; bấm từng video hoặc tải tất cả
            khi cần check đồng loạt.
          </p>
        </div>
      </Card>

      {loadState === "idle" ? (
        <Card>
          <CardTitle>Danh sách video</CardTitle>
          <div className="mt-4 grid min-h-[28rem] place-items-center rounded-xl border border-dashed border-border bg-surface/60 p-8 text-center">
            <div>
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon name="play" size={20} />
              </div>
              <p className="font-semibold">Nhập link nguồn để tải video.</p>
              <p className="mt-1 text-sm text-muted">
                Hỗ trợ YouTube, TikTok và Facebook public.
              </p>
            </div>
          </div>
        </Card>
      ) : loadState === "loading" ? (
        <Card>
          <CardTitle>Đang tải</CardTitle>
          <div className="mt-4 grid min-h-[28rem] place-items-center rounded-xl border border-border bg-surface/60 p-8 text-center">
            <div>
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="font-semibold">Đang đọc video từ nguồn...</p>
              <p className="mt-1 max-w-md break-all text-sm text-muted">
                {submittedUrl}
              </p>
            </div>
          </div>
        </Card>
      ) : videos.length > 0 ? (
        <div className={wallClasses(layoutMode)}>
          {videos.map((video, index) => {
            const loaded = loadedVideoKeys.includes(videoKey(video));
            return (
              <div
                key={videoKey(video)}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-md)]"
              >
                <div className="flex min-h-14 items-center gap-3 border-b border-border bg-surface/80 px-3 py-2">
                  <Badge tone="neutral">#{index + 1}</Badge>
                  <Badge tone="primary">{platformLabel[video.platform]}</Badge>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold">{video.title}</p>
                    <p className="text-xs text-muted">{formatPublished(video.publishedAt)}</p>
                  </div>
                </div>
                <div className="relative aspect-video bg-black">
                  {loaded ? (
                    <iframe
                      src={embedUrlFor(video)}
                      title={video.title}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; encrypted-media; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                      scrolling="no"
                      style={{ border: 0, overflow: "hidden" }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => loadPlayer(video)}
                      className="group absolute inset-0 block w-full overflow-hidden text-left"
                    >
                      {video.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover opacity-85 transition group-hover:scale-[1.02] group-hover:opacity-100"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center bg-surface text-sm font-semibold text-white/70">
                          {platformLabel[video.platform]}
                        </span>
                      )}
                      <span className="absolute inset-0 bg-black/30" />
                      <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-fg shadow-[var(--shadow-md)]">
                        <Icon name="play" size={22} />
                      </span>
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate text-sm font-semibold text-primary hover:underline"
                  >
                    Mở trên {platformLabel[video.platform]}
                  </a>
                  {!loaded && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => loadPlayer(video)}
                    >
                      <Icon name="play" size={14} />
                      Tải player
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardTitle>Không có video</CardTitle>
          <div className="mt-4 rounded-xl border border-border bg-surface/60 p-8 text-center">
            <p className="font-semibold">Chưa tìm thấy video public để hiển thị.</p>
            <p className="mt-1 text-sm text-muted">
              Thử link profile/page public hoặc link video trực tiếp.
            </p>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
