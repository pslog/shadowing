import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Platform = "youtube" | "tiktok" | "facebook";

interface SourceVideo {
  id: string;
  platform: Platform;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
}

interface YouTubeScrape {
  videos: SourceVideo[];
  continuations: string[];
}

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function decodeJsonString(raw: string) {
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return raw;
  }
}

function decodeHtml(raw: string) {
  return raw
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textBetween(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return decodeHtml(decodeJsonString(match[1]));
  }
  return null;
}

function detectPlatform(url: URL): Platform | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("facebook.com") || host.includes("fb.watch")) return "facebook";
  return null;
}

function parseJsonObjectFrom(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = html.indexOf("{", markerIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1)) as unknown;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function simpleText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const text = value as {
    simpleText?: string;
    runs?: Array<{ text?: string }>;
  };

  return text.simpleText ?? text.runs?.map((run) => run.text ?? "").join("") ?? null;
}

function youtubeThumbnail(value: unknown, videoId: string) {
  if (!value || typeof value !== "object") {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  const thumbnail = value as { thumbnails?: Array<{ url?: string }> };
  return (
    thumbnail.thumbnails?.at(-1)?.url?.replace(/\\u0026/g, "&") ??
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

function collectYouTubeVideosFromJson(root: unknown): YouTubeScrape {
  const videos = new Map<string, SourceVideo>();
  const continuations = new Set<string>();

  function visit(node: unknown) {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const videoRenderer = record.videoRenderer as
      | {
          videoId?: string;
          title?: unknown;
          thumbnail?: unknown;
          publishedTimeText?: unknown;
        }
      | undefined;

    if (videoRenderer?.videoId && !videos.has(videoRenderer.videoId)) {
      videos.set(videoRenderer.videoId, {
        id: videoRenderer.videoId,
        platform: "youtube",
        title: simpleText(videoRenderer.title) ?? videoRenderer.videoId,
        url: `https://www.youtube.com/watch?v=${videoRenderer.videoId}`,
        thumbnailUrl: youtubeThumbnail(videoRenderer.thumbnail, videoRenderer.videoId),
        publishedAt: simpleText(videoRenderer.publishedTimeText),
      });
    }

    const continuationCommand = record.continuationCommand as
      | { token?: string }
      | undefined;
    const reloadContinuationData = record.reloadContinuationData as
      | { continuation?: string }
      | undefined;
    const appendContinuationItemsAction = record.appendContinuationItemsAction as
      | { continuationItems?: unknown[] }
      | undefined;

    if (continuationCommand?.token) continuations.add(continuationCommand.token);
    if (reloadContinuationData?.continuation) {
      continuations.add(reloadContinuationData.continuation);
    }
    if (appendContinuationItemsAction?.continuationItems) {
      visit(appendContinuationItemsAction.continuationItems);
    }

    for (const value of Object.values(record)) visit(value);
  }

  visit(root);

  return {
    videos: [...videos.values()],
    continuations: [...continuations],
  };
}

async function fetchText(url: string, platform: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`${platform} returned ${response.status}`);
  }

  return response.text();
}

function youtubeVideoIdFromUrl(url: URL) {
  if (url.hostname.includes("youtu.be")) {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/").filter(Boolean)[1] ?? null;
  }
  return url.searchParams.get("v");
}

function youtubeChannelPageUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts[0] === "channel" && parts[1]) {
    return {
      channelId: parts[1],
      videosUrl: `https://www.youtube.com/channel/${parts[1]}/videos`,
    };
  }

  const basePath = parts[0]?.startsWith("@")
    ? `/${parts[0]}`
    : parts.length > 0
      ? `/${parts[0]}${parts[1] ? `/${parts[1]}` : ""}`
      : "";

  if (!basePath) return null;
  return {
    channelId: null,
    videosUrl: `https://www.youtube.com${basePath}/videos`,
  };
}

function parseYouTubeRssVideos(xml: string): SourceVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const videos: SourceVideo[] = [];

  for (const entry of entries) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!id) continue;

    const title = entry.match(/<media:title>([^<]+)<\/media:title>/)?.[1] ?? id;
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null;
    const thumbnailUrl =
      entry.match(/<media:thumbnail url="([^"]+)"/)?.[1] ??
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    videos.push({
      id,
      platform: "youtube",
      title: decodeHtml(title),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl,
      publishedAt,
    });
  }

  return videos;
}

function parseYouTubeHtmlVideos(html: string): SourceVideo[] {
  const videoIds = [...html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)].map(
    (match) => match[1],
  );
  const uniqueIds = [...new Set(videoIds)];

  return uniqueIds.map((id) => {
    const index = html.indexOf(`"videoId":"${id}"`);
    const nearby = index >= 0 ? html.slice(index, index + 3000) : "";
    const title =
      textBetween(nearby, [
        /"title":\{"runs":\[\{"text":"([^"]+)"/,
        /"title":\{"simpleText":"([^"]+)"/,
        /"accessibilityData":\{"label":"([^"]+)"/,
      ]) ?? id;
    const publishedAt =
      textBetween(nearby, [/"publishedTimeText":\{"simpleText":"([^"]+)"/]) ??
      null;

    return {
      id,
      platform: "youtube",
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publishedAt,
    };
  });
}

async function fetchYouTubeContinuationVideos(
  apiKey: string | null,
  clientVersion: string | null,
  initialTokens: string[],
) {
  if (!apiKey || !clientVersion || initialTokens.length === 0) {
    return [] satisfies SourceVideo[];
  }

  const videos: SourceVideo[] = [];
  const queue = [...initialTokens];
  const seenTokens = new Set<string>();
  const maxPages = 50;

  while (queue.length > 0 && seenTokens.size < maxPages && videos.length < 1000) {
    const token = queue.shift();
    if (!token || seenTokens.has(token)) continue;
    seenTokens.add(token);

    const response = await fetch(
      `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion,
            },
          },
          continuation: token,
        }),
      },
    );

    if (!response.ok) break;

    const scraped = collectYouTubeVideosFromJson(await response.json());
    videos.push(...scraped.videos);
    for (const nextToken of scraped.continuations) {
      if (!seenTokens.has(nextToken)) queue.push(nextToken);
    }
  }

  return videos;
}

function mergeVideos(...groups: SourceVideo[][]) {
  const byKey = new Map<string, SourceVideo>();
  for (const video of groups.flat()) {
    const key = `${video.platform}:${video.id}`;
    const current = byKey.get(key);
    byKey.set(key, {
      ...video,
      title: current?.title && current.title !== current.id ? current.title : video.title,
      publishedAt: current?.publishedAt ?? video.publishedAt,
      thumbnailUrl: current?.thumbnailUrl ?? video.thumbnailUrl,
    });
  }
  return [...byKey.values()];
}

async function resolveYouTube(rawUrl: string) {
  const target = new URL(normalizeUrl(rawUrl));
  const directVideoId = youtubeVideoIdFromUrl(target);
  if (directVideoId) {
    return {
      videos: [
        {
          id: directVideoId,
          platform: "youtube" as const,
          title: directVideoId,
          url: `https://www.youtube.com/watch?v=${directVideoId}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
          publishedAt: null,
        },
      ],
      source: "youtube-video",
      platform: "youtube",
    };
  }

  const channel = youtubeChannelPageUrl(target.href);
  if (!channel) throw new Error("Không đọc được link YouTube channel.");

  const html = await fetchText(channel.videosUrl, "YouTube");
  const initialData =
    parseJsonObjectFrom(html, "var ytInitialData =") ??
    parseJsonObjectFrom(html, "window[\"ytInitialData\"] =");
  const scrapedInitial = collectYouTubeVideosFromJson(initialData);
  const apiKey = textBetween(html, [/"INNERTUBE_API_KEY":"([^"]+)"/]);
  const clientVersion = textBetween(html, [/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/]);
  const continuationVideos = await fetchYouTubeContinuationVideos(
    apiKey,
    clientVersion,
    scrapedInitial.continuations,
  );
  const channelId =
    channel.channelId ??
    textBetween(html, [
      /"channelId":"(UC[A-Za-z0-9_-]+)"/,
      /"externalId":"(UC[A-Za-z0-9_-]+)"/,
      /<meta itemprop="channelId" content="(UC[A-Za-z0-9_-]+)">/,
    ]);
  const rssVideos = channelId
    ? parseYouTubeRssVideos(
        await fetchText(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
          "YouTube RSS",
        ),
      )
    : [];

  return {
    videos: mergeVideos(
      rssVideos,
      scrapedInitial.videos,
      continuationVideos,
      parseYouTubeHtmlVideos(html),
    ),
    source: channelId ? "youtube-channel" : "youtube-channel-page",
    platform: "youtube",
  };
}

function tiktokVideoIdFromUrl(url: URL) {
  return url.pathname.match(/\/video\/(\d+)/)?.[1] ?? null;
}

function tiktokHandleFromUrl(url: URL) {
  return (
    url.pathname
    .split("/")
    .filter(Boolean)
    .find((part) => part.startsWith("@"))
      ?.replace(/^@/, "") ?? null
  );
}

function parseTikTokVideos(html: string, handle: string | null): SourceVideo[] {
  const videos = new Map<string, SourceVideo>();
  const ids = [
    ...html.matchAll(/"id":"(\d{15,25})"/g),
    ...html.matchAll(/\\"id\\":\\"(\d{15,25})\\"/g),
    ...html.matchAll(/\/video\/(\d{15,25})/g),
  ].map((match) => match[1]);

  for (const id of [...new Set(ids)]) {
    const index = Math.max(
      html.indexOf(`"id":"${id}"`),
      html.indexOf(`\\"id\\":\\"${id}\\"`),
      html.indexOf(`/video/${id}`),
    );
    const nearby = index >= 0 ? html.slice(Math.max(0, index - 2000), index + 5000) : "";
    const title =
      textBetween(nearby, [
        /"desc":"([^"]*)"/,
        /\\"desc\\":\\"([^"]*)\\"/,
        /"shareTitle":"([^"]*)"/,
      ]) ?? id;
    const thumbnailUrl = textBetween(nearby, [
      /"cover":"([^"]+)"/,
      /\\"cover\\":\\"([^"]+)\\"/,
      /"originCover":"([^"]+)"/,
      /\\"originCover\\":\\"([^"]+)\\"/,
    ]);
    const author =
      textBetween(nearby, [
        /"uniqueId":"([^"]+)"/,
        /\\"uniqueId\\":\\"([^"]+)\\"/,
      ]) ?? handle;

    videos.set(id, {
      id,
      platform: "tiktok",
      title: title || id,
      url: author
        ? `https://www.tiktok.com/@${author}/video/${id}`
        : `https://www.tiktok.com/video/${id}`,
      thumbnailUrl,
      publishedAt: null,
    });
  }

  return [...videos.values()];
}

async function resolveTikTok(rawUrl: string) {
  const target = new URL(normalizeUrl(rawUrl));
  const directVideoId = tiktokVideoIdFromUrl(target);
  if (directVideoId) {
    return {
      videos: [
        {
          id: directVideoId,
          platform: "tiktok" as const,
          title: directVideoId,
          url: target.href,
          thumbnailUrl: null,
          publishedAt: null,
        },
      ],
      source: "tiktok-video",
      platform: "tiktok",
    };
  }

  const html = await fetchText(target.href, "TikTok");
  const videos = parseTikTokVideos(html, tiktokHandleFromUrl(target));
  return {
    videos,
    source: "tiktok-profile",
    platform: "tiktok",
  };
}

function facebookVideoIdFromUrl(url: URL) {
  if (url.pathname.includes("/reel/") || url.pathname.includes("/reels/")) {
    return url.pathname.match(/\/reels?\/(\d+)/)?.[1] ?? null;
  }
  if (url.pathname.includes("/videos/")) {
    return url.pathname.match(/\/videos\/(?:[^/]+\/)?(\d+)/)?.[1] ?? null;
  }
  return url.searchParams.get("v");
}

function facebookVideosUrl(url: URL) {
  if (
    url.searchParams.get("v") ||
    url.pathname.includes("/videos/") ||
    url.pathname.includes("/reel/")
  ) {
    return url.href;
  }

  const cleanPath = url.pathname.replace(/\/$/, "");
  return `${url.origin}${cleanPath}/videos`;
}

function parseFacebookVideos(html: string, fallbackUrl: string): SourceVideo[] {
  const videos = new Map<string, SourceVideo>();
  const pageTitle =
    textBetween(html, [
      /<meta property="og:title" content="([^"]+)"/,
      /<title>([^<]+)<\/title>/,
    ]) ?? "Facebook video";
  const pageThumbnail = textBetween(html, [
    /<meta property="og:image" content="([^"]+)"/,
  ]);

  const ids = [
    ...html.matchAll(/"video_id":"(\d+)"/g),
    ...html.matchAll(/\\"video_id\\":\\"(\d+)\\"/g),
    ...html.matchAll(/\/videos\/(\d+)/g),
    ...html.matchAll(/\/watch\/\?v=(\d+)/g),
    ...html.matchAll(/\/reels?\/(\d+)/g),
  ].map((match) => match[1]);

  for (const id of [...new Set(ids)]) {
    const index = html.indexOf(id);
    const nearby = index >= 0 ? html.slice(Math.max(0, index - 2000), index + 4000) : "";
    const title =
      textBetween(nearby, [
        /"title":"([^"]+)"/,
        /\\"title\\":\\"([^"]+)\\"/,
        /"name":"([^"]+)"/,
      ]) ?? pageTitle;
    const thumbnailUrl =
      textBetween(nearby, [
        /"thumbnailImage":\{"uri":"([^"]+)"/,
        /\\"thumbnailImage\\":\{\\"uri\\":\\"([^"]+)\\"/,
        /"preferred_thumbnail":\{"image":\{"uri":"([^"]+)"/,
      ]) ?? pageThumbnail;

    videos.set(id, {
      id,
      platform: "facebook",
      title: title || id,
      url: `https://www.facebook.com/watch/?v=${id}`,
      thumbnailUrl,
      publishedAt: null,
    });
  }

  if (videos.size === 0) {
    const directId = textBetween(fallbackUrl, [
      /[?&]v=(\d+)/,
      /\/videos\/(\d+)/,
      /\/reels?\/(\d+)/,
    ]);
    if (directId) {
      videos.set(directId, {
        id: directId,
        platform: "facebook",
        title: pageTitle,
        url: fallbackUrl,
        thumbnailUrl: pageThumbnail,
        publishedAt: null,
      });
    }
  }

  return [...videos.values()];
}

async function resolveFacebook(rawUrl: string) {
  const target = new URL(normalizeUrl(rawUrl));
  const directVideoId = facebookVideoIdFromUrl(target);
  const html = await fetchText(facebookVideosUrl(target), "Facebook");
  const videos = parseFacebookVideos(html, target.href);

  if (directVideoId && !videos.some((video) => video.id === directVideoId)) {
    videos.unshift({
      id: directVideoId,
      platform: "facebook",
      title:
        textBetween(html, [
          /<meta property="og:title" content="([^"]+)"/,
          /<title>([^<]+)<\/title>/,
        ]) ?? directVideoId,
      url: target.href,
      thumbnailUrl: textBetween(html, [
        /<meta property="og:image" content="([^"]+)"/,
      ]),
      publishedAt: null,
    });
  }

  return {
    videos,
    source: directVideoId ? "facebook-video" : "facebook-page",
    platform: "facebook",
  };
}

async function resolveSource(rawUrl: string) {
  const target = new URL(normalizeUrl(rawUrl));
  const platform = detectPlatform(target);

  if (platform === "youtube") return resolveYouTube(target.href);
  if (platform === "tiktok") return resolveTikTok(target.href);
  if (platform === "facebook") return resolveFacebook(target.href);

  throw new Error("Hiện hỗ trợ YouTube, TikTok và Facebook.");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawSourceUrl = url.searchParams.get("url") ?? "";
    if (!rawSourceUrl.trim()) {
      return NextResponse.json({ error: "Thiếu link nguồn." }, { status: 400 });
    }

    const result = await resolveSource(rawSourceUrl);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tải được danh sách video.",
      },
      { status: 500 },
    );
  }
}
