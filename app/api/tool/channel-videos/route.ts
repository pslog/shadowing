import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ChannelVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string | null;
}

interface ScrapedVideos {
  videos: ChannelVideo[];
  continuations: string[];
}

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function jsonStringValue(raw: string) {
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return raw;
  }
}

function textBetween(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return jsonStringValue(match[1]);
  }
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

function thumbnailUrl(value: unknown, videoId: string) {
  if (!value || typeof value !== "object") {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  const thumbnail = value as { thumbnails?: Array<{ url?: string }> };
  return (
    thumbnail.thumbnails?.at(-1)?.url?.replace(/\\u0026/g, "&") ??
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

function collectVideosFromJson(root: unknown): ScrapedVideos {
  const videos = new Map<string, ChannelVideo>();
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
        title: simpleText(videoRenderer.title) ?? videoRenderer.videoId,
        url: `https://www.youtube.com/watch?v=${videoRenderer.videoId}`,
        thumbnailUrl: thumbnailUrl(videoRenderer.thumbnail, videoRenderer.videoId),
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

function videoIdFromUrl(url: URL) {
  if (url.hostname.includes("youtu.be")) {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/").filter(Boolean)[1] ?? null;
  }
  return url.searchParams.get("v");
}

function channelPageUrl(rawUrl: string) {
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

async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube returned ${response.status}`);
  }

  return response.text();
}

function parseRssVideos(xml: string): ChannelVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

  return entries
    .map((entry) => {
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      if (!id) return null;

      const title = entry.match(/<media:title>([^<]+)<\/media:title>/)?.[1] ?? id;
      const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null;
      const thumbnailUrl =
        entry.match(/<media:thumbnail url="([^"]+)"/)?.[1] ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      return {
        id,
        title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"'),
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnailUrl,
        publishedAt,
      };
    })
    .filter((video): video is ChannelVideo => Boolean(video));
}

function parseHtmlVideos(html: string) {
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
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publishedAt,
    };
  });
}

async function fetchContinuationVideos(
  apiKey: string | null,
  clientVersion: string | null,
  initialTokens: string[],
) {
  if (!apiKey || !clientVersion || initialTokens.length === 0) {
    return [] satisfies ChannelVideo[];
  }

  const videos: ChannelVideo[] = [];
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

    const scraped = collectVideosFromJson(await response.json());
    videos.push(...scraped.videos);
    for (const nextToken of scraped.continuations) {
      if (!seenTokens.has(nextToken)) queue.push(nextToken);
    }
  }

  return videos;
}

function mergeVideos(primary: ChannelVideo[], secondary: ChannelVideo[]) {
  const byId = new Map<string, ChannelVideo>();
  for (const video of [...primary, ...secondary]) {
    const current = byId.get(video.id);
    byId.set(video.id, {
      ...video,
      title: current?.title && current.title !== current.id ? current.title : video.title,
      publishedAt: current?.publishedAt ?? video.publishedAt,
      thumbnailUrl: current?.thumbnailUrl ?? video.thumbnailUrl,
    });
  }
  return [...byId.values()];
}

async function resolveChannel(rawUrl: string) {
  const target = new URL(normalizeUrl(rawUrl));
  if (!target.hostname.includes("youtube.com") && !target.hostname.includes("youtu.be")) {
    throw new Error("Hiện chỉ hỗ trợ link YouTube channel.");
  }

  const directVideoId = videoIdFromUrl(target);
  if (directVideoId) {
    return {
      videos: [
        {
          id: directVideoId,
          title: directVideoId,
          url: `https://www.youtube.com/watch?v=${directVideoId}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
          publishedAt: null,
        },
      ],
      source: "video",
    };
  }

  const channel = channelPageUrl(target.href);
  if (!channel) throw new Error("Không đọc được link channel YouTube.");

  const html = await fetchText(channel.videosUrl);
  const initialData =
    parseJsonObjectFrom(html, "var ytInitialData =") ??
    parseJsonObjectFrom(html, "window[\"ytInitialData\"] =");
  const scrapedInitial = collectVideosFromJson(initialData);
  const apiKey = textBetween(html, [/"INNERTUBE_API_KEY":"([^"]+)"/]);
  const clientVersion = textBetween(html, [/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/]);
  const continuationVideos = await fetchContinuationVideos(
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

  const htmlVideos = parseHtmlVideos(html);
  const rssVideos = channelId
    ? parseRssVideos(
        await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`),
      )
    : [];

  return {
    videos: mergeVideos(rssVideos, [
      ...scrapedInitial.videos,
      ...continuationVideos,
      ...htmlVideos,
    ]),
    source: channelId ? "channel" : "channel-page",
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawChannelUrl = url.searchParams.get("url") ?? "";
    if (!rawChannelUrl.trim()) {
      return NextResponse.json({ error: "Thiếu link channel." }, { status: 400 });
    }

    const result = await resolveChannel(rawChannelUrl);
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
