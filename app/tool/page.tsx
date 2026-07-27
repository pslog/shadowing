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

type Platform = "youtube" | "facebook" | "tiktok" | "unknown";
type LayoutMode = "grid" | "cinema" | "mosaic";

const platformLabel: Record<Platform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  tiktok: "TikTok",
  unknown: "Link",
};

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function detectPlatform(rawUrl: string): Platform {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, "");
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("facebook.com") || host.includes("fb.watch")) return "facebook";
    if (host.includes("tiktok.com")) return "tiktok";
  } catch {
    return "unknown";
  }
  return "unknown";
}

function youtubeEmbedUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  let videoId = "";

  if (url.hostname.includes("youtu.be")) {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (url.pathname.startsWith("/shorts/")) {
    videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
  } else {
    videoId = url.searchParams.get("v") ?? "";
  }

  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&playsinline=1` : null;
}

function tiktokEmbedUrl(rawUrl: string) {
  const match = rawUrl.match(/\/video\/(\d+)/);
  return match?.[1]
    ? `https://www.tiktok.com/player/v1/${match[1]}?autoplay=1`
    : null;
}

function facebookEmbedUrl(rawUrl: string) {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    rawUrl,
  )}&show_text=false&autoplay=true&mute=false`;
}

function embedUrlFor(rawUrl: string, platform: Platform) {
  try {
    if (platform === "youtube") return youtubeEmbedUrl(rawUrl);
    if (platform === "tiktok") return tiktokEmbedUrl(rawUrl);
    if (platform === "facebook") return facebookEmbedUrl(rawUrl);
  } catch {
    return null;
  }
  return null;
}

function wallClasses(mode: LayoutMode) {
  if (mode === "cinema") return "grid justify-items-center gap-4 sm:grid-cols-2 xl:grid-cols-4";
  if (mode === "mosaic") return "grid justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
  return "grid justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function windowClasses(mode: LayoutMode, index: number) {
  if (mode === "cinema" && index === 0) return "w-full max-w-[360px] sm:col-span-2";
  if (mode === "mosaic" && index % 5 === 0) return "w-full max-w-[320px]";
  return "w-full max-w-[260px]";
}

export default function ToolPage() {
  const { profile, ready } = useRequireProfile();
  const [rawUrl, setRawUrl] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [windowCount, setWindowCount] = useState(6);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [loadedWindows, setLoadedWindows] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const normalizedUrl = useMemo(() => normalizeUrl(submittedUrl), [submittedUrl]);
  const platform = useMemo(() => detectPlatform(normalizedUrl), [normalizedUrl]);
  const embedUrl = useMemo(
    () => (normalizedUrl ? embedUrlFor(normalizedUrl, platform) : null),
    [normalizedUrl, platform],
  );
  const windows = useMemo(
    () => Array.from({ length: windowCount }, (_, index) => index),
    [windowCount],
  );

  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdminProfile(profile)) return <AdminOnlyNotice />;

  function renderWall() {
    const nextUrl = normalizeUrl(rawUrl);
    if (!nextUrl) {
      setError("Nhập một link video trước.");
      return;
    }
    setSubmittedUrl(nextUrl);
    setLoadedWindows([]);
    setError(null);
  }

  function loadWindow(index: number) {
    setLoadedWindows((current) =>
      current.includes(index) ? current : [...current, index],
    );
  }

  function loadAllWindows() {
    setLoadedWindows(windows);
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-muted hover:text-fg">
            Về dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Tường xem trước video</h1>
          <p className="max-w-3xl text-muted">
            Nhập một link video và hiển thị thành nhiều cửa sổ dọc kiểu TikTok.
            Không autoplay, mỗi player chỉ tải khi bấm nút trong từng khung.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{windowCount} cửa sổ</Badge>
          <Badge tone="neutral">{platformLabel[platform]}</Badge>
        </div>
      </div>

      <Card className="mb-5">
        <CardTitle>Link video</CardTitle>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={rawUrl}
            onChange={(event) => setRawUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") renderWall();
            }}
            placeholder="https://www.youtube.com/watch?v=... | facebook video | tiktok video"
            className="focus-ring h-11 w-full rounded-xl border border-border bg-surface px-3 font-mono text-sm outline-none"
          />
          <Button type="button" onClick={renderWall}>
            <Icon name="play" size={16} />
            Tạo tường preview
          </Button>
        </div>
        {error && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="window-count">
              Số cửa sổ
            </label>
            <input
              id="window-count"
              type="range"
              min={2}
              max={12}
              value={windowCount}
              onChange={(event) => {
                setWindowCount(Number(event.target.value));
                setLoadedWindows([]);
              }}
              className="mt-3 w-full accent-[var(--primary)]"
            />
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>2</span>
              <span>{windowCount}</span>
              <span>12</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Kiểu hiển thị</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["grid", "cinema", "mosaic"] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={layoutMode === mode ? "primary" : "outline"}
                  onClick={() => setLayoutMode(mode)}
                >
                  {mode === "grid" ? "Lưới" : mode === "cinema" ? "Sân khấu" : "Mosaic"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={loadAllWindows}
            disabled={!submittedUrl || !embedUrl || loadedWindows.length === windows.length}
          >
            <Icon name="play" size={16} />
            Tải toàn bộ player
          </Button>
          <p className="text-sm text-muted">
            Trình duyệt và nền tảng video yêu cầu người dùng tự bấm phát trong player.
          </p>
        </div>
      </Card>

      {!submittedUrl ? (
        <Card>
          <CardTitle>Tường preview</CardTitle>
          <div className="mt-4 grid min-h-[28rem] place-items-center rounded-xl border border-dashed border-border bg-surface/60 p-8 text-center">
            <div>
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon name="play" size={20} />
              </div>
              <p className="font-semibold">Nhập một link để tạo nhiều cửa sổ dọc.</p>
              <p className="mt-1 text-sm text-muted">
                Page này không tự động phát video và không lặp view.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className={wallClasses(layoutMode)}>
          {windows.map((index) => {
            const loaded = loadedWindows.includes(index);
            return (
              <div
                key={index}
                className={`overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-md)] ${windowClasses(
                  layoutMode,
                  index,
                )}`}
              >
                <div className="flex h-10 items-center gap-2 border-b border-border bg-surface/80 px-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald" />
                  <span className="ml-2 min-w-0 truncate text-xs font-semibold text-muted">
                    Cửa sổ {index + 1} - {platformLabel[platform]}
                  </span>
                </div>
                <div className="relative aspect-[9/16] bg-black">
                  {loaded && embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={`Cửa sổ xem trước ${index + 1}`}
                      className="h-full w-full"
                      allow="encrypted-media; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                      scrolling="no"
                      style={{ border: 0, overflow: "hidden" }}
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center p-4 text-center">
                      <div>
                        <Badge tone="neutral">{platformLabel[platform]}</Badge>
                        <p className="mt-3 max-w-xs break-all text-xs text-white/70">
                          {submittedUrl}
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          className="mt-4 bg-white text-fg hover:bg-white/90"
                          onClick={() => loadWindow(index)}
                          disabled={!embedUrl}
                        >
                          <Icon name="play" size={15} />
                          Tải player
                        </Button>
                        {!embedUrl && (
                          <p className="mt-3 text-xs text-white/60">
                            Link này không tạo được embed. Hãy mở link gốc.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
