import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Platform = "youtube" | "tiktok" | "facebook";
type UploadStatus = "success" | "error" | "not_configured";

interface UploadResult {
  platform: Platform;
  status: UploadStatus;
  message: string;
  id?: string;
  url?: string;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

function stringValue(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value : fallback;
}

function parsePlatforms(formData: FormData) {
  const selected = formData
    .getAll("platforms")
    .filter((value): value is Platform =>
      value === "youtube" || value === "tiktok" || value === "facebook",
    );

  return [...new Set(selected)];
}

function missingConfig(platform: Platform, names: string[]): UploadResult {
  return {
    platform,
    status: "not_configured",
    message: `Thiếu ${names.join(", ")} trong .env.`,
  };
}

function errorResult(platform: Platform, error: unknown): UploadResult {
  return {
    platform,
    status: "error",
    message:
      error instanceof Error
        ? error.message
        : `Không upload được lên ${PLATFORM_LABEL[platform]}.`,
  };
}

async function responseError(response: Response) {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return json.error?.message ?? json.message ?? text;
  } catch {
    return text;
  }
}

async function uploadYouTube(input: {
  file: File;
  title: string;
  description: string;
  privacy: string;
}): Promise<UploadResult> {
  const accessToken = process.env.YOUTUBE_ACCESS_TOKEN;
  if (!accessToken) return missingConfig("youtube", ["YOUTUBE_ACCESS_TOKEN"]);

  const metadata = {
    snippet: {
      title: input.title,
      description: input.description,
    },
    status: {
      privacyStatus: input.privacy,
      selfDeclaredMadeForKids: false,
    },
  };

  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(input.file.size),
        "X-Upload-Content-Type": input.file.type || "video/mp4",
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initResponse.ok) {
    throw new Error(await responseError(initResponse));
  }

  const uploadUrl = initResponse.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube không trả resumable upload URL.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": input.file.type || "video/mp4",
      "Content-Length": String(input.file.size),
    },
    body: input.file,
  });

  if (!uploadResponse.ok) {
    throw new Error(await responseError(uploadResponse));
  }

  const payload = (await uploadResponse.json()) as { id?: string };
  return {
    platform: "youtube",
    status: "success",
    message: "Đã upload lên YouTube.",
    id: payload.id,
    url: payload.id ? `https://www.youtube.com/watch?v=${payload.id}` : undefined,
  };
}

function tiktokEndpoint() {
  return process.env.TIKTOK_DIRECT_POST === "true"
    ? "https://open.tiktokapis.com/v2/post/publish/video/init/"
    : "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
}

async function uploadTikTok(input: {
  file: File;
  title: string;
  privacy: string;
}): Promise<UploadResult> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) return missingConfig("tiktok", ["TIKTOK_ACCESS_TOKEN"]);

  const directPost = process.env.TIKTOK_DIRECT_POST === "true";
  const chunkSize = input.file.size;
  const postInfo = directPost
    ? {
        title: input.title,
        privacy_level:
          input.privacy === "public" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      }
    : {
        title: input.title,
      };

  const initResponse = await fetch(tiktokEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: postInfo,
      source_info: {
        source: "FILE_UPLOAD",
        video_size: input.file.size,
        chunk_size: chunkSize,
        total_chunk_count: 1,
      },
    }),
  });

  if (!initResponse.ok) {
    throw new Error(await responseError(initResponse));
  }

  const initPayload = (await initResponse.json()) as {
    data?: { upload_url?: string; publish_id?: string };
    error?: { message?: string };
  };
  const uploadUrl = initPayload.data?.upload_url;
  if (!uploadUrl) {
    throw new Error(initPayload.error?.message ?? "TikTok không trả upload_url.");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": input.file.type || "video/mp4",
      "Content-Length": String(input.file.size),
      "Content-Range": `bytes 0-${input.file.size - 1}/${input.file.size}`,
    },
    body: input.file,
  });

  if (!uploadResponse.ok) {
    throw new Error(await responseError(uploadResponse));
  }

  return {
    platform: "tiktok",
    status: "success",
    message: directPost
      ? "Đã gửi video để TikTok publish."
      : "Đã upload lên TikTok inbox, cần hoàn tất trong TikTok.",
    id: initPayload.data?.publish_id,
  };
}

async function uploadFacebook(input: {
  file: File;
  title: string;
  description: string;
  privacy: string;
}): Promise<UploadResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !accessToken) {
    return missingConfig("facebook", [
      "FACEBOOK_PAGE_ID",
      "FACEBOOK_PAGE_ACCESS_TOKEN",
    ]);
  }

  const formData = new FormData();
  formData.set("source", input.file);
  formData.set("title", input.title);
  formData.set("description", input.description);
  formData.set("published", input.privacy === "public" ? "true" : "false");
  formData.set("access_token", accessToken);

  const response = await fetch(`https://graph-video.facebook.com/v25.0/${pageId}/videos`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await responseError(response));
  }

  const payload = (await response.json()) as { id?: string };
  return {
    platform: "facebook",
    status: "success",
    message: "Đã upload lên Facebook Page.",
    id: payload.id,
    url: payload.id ? `https://www.facebook.com/${payload.id}` : undefined,
  };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("video");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file video." }, { status: 400 });
  }

  const platforms = parsePlatforms(formData);
  if (platforms.length === 0) {
    return NextResponse.json(
      { error: "Chọn ít nhất một nền tảng." },
      { status: 400 },
    );
  }

  const title = stringValue(formData, "title", file.name.replace(/\.[^.]+$/, ""));
  const description = stringValue(formData, "description");
  const privacy = stringValue(formData, "privacy", "private");

  const results: UploadResult[] = [];
  for (const platform of platforms) {
    try {
      if (platform === "youtube") {
        results.push(await uploadYouTube({ file, title, description, privacy }));
      } else if (platform === "tiktok") {
        results.push(await uploadTikTok({ file, title, privacy }));
      } else {
        results.push(await uploadFacebook({ file, title, description, privacy }));
      }
    } catch (error) {
      results.push(errorResult(platform, error));
    }
  }

  return NextResponse.json({
    file: {
      name: file.name,
      size: file.size,
      type: file.type,
    },
    results,
  });
}
