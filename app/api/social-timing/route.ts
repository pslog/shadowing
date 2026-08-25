import { execFile } from "node:child_process";
import { mkdir, readdir, stat, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const lessonPattern = /^m[1-9]\d*-q[1-9]\d*$/;
const examPattern = /^\d{4}-\d{2}$/;

type TimingLine = { sp: string; ja: string; start: number; end: number };

function validId(exam: string | null, lesson: string | null) {
  return !!exam && !!lesson && examPattern.test(exam) && lessonPattern.test(lesson);
}

function overridePath(exam: string, lesson: string) {
  return path.join(root, "resources", "generated", "n2-whisper", "overrides", `${exam}_${lesson}.json`);
}

type LessonId = { exam: string; lesson: string };

async function newestLesson(): Promise<LessonId> {
  const candidates: Array<LessonId & { modified: number }> = [];
  const audioRoot = path.join(root, "public", "audio", "n2");
  const exams = await readdir(audioRoot, { withFileTypes: true });

  for (const examEntry of exams) {
    if (!examEntry.isDirectory() || !examPattern.test(examEntry.name)) continue;
    const directory = path.join(audioRoot, examEntry.name);
    const files = await readdir(directory, { withFileTypes: true });
    for (const file of files) {
      const match = /^(m\d+-q\d+)(?:-bg\.(?:png|jpe?g|webp)|\.social\.mp4)$/i.exec(file.name);
      if (!file.isFile() || !match) continue;
      const info = await stat(path.join(directory, file.name));
      candidates.push({ exam: examEntry.name, lesson: match[1], modified: info.mtimeMs });
    }
  }

  const overridesDirectory = path.join(root, "resources", "generated", "n2-whisper", "overrides");
  const overrides = await readdir(overridesDirectory, { withFileTypes: true }).catch(() => []);
  for (const file of overrides) {
    const match = /^(\d{4}-\d{2})_(m\d+-q\d+)\.json$/.exec(file.name);
    if (!file.isFile() || !match) continue;
    const info = await stat(path.join(overridesDirectory, file.name));
    candidates.push({ exam: match[1], lesson: match[2], modified: info.mtimeMs });
  }

  const latest = candidates.sort((a, b) => b.modified - a.modified)[0];
  if (!latest) throw new Error("Chưa có lesson nào đã được tạo ảnh nền, lưu timing hoặc render video.");
  return { exam: latest.exam, lesson: latest.lesson };
}

async function loadLesson(exam: string, lesson: string) {
  const result = await execFileAsync("python", ["scripts/social_timing_editor.py", "--exam", exam, "--lesson", lesson], {
    cwd: root,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  return JSON.parse(result.stdout) as { duration: number; lines: TimingLine[] } & Record<string, unknown>;
}

function validateLines(value: unknown, duration: number): TimingLine[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Cần ít nhất một câu thoại.");
  let previousStart = -0.01;
  return value.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error(`Dòng ${index + 1} không hợp lệ.`);
    const item = row as Record<string, unknown>;
    const sp = typeof item.sp === "string" ? item.sp.trim() : "";
    const ja = typeof item.ja === "string" ? item.ja.trim() : "";
    const start = Number(item.start);
    const end = Number(item.end);
    if (!ja || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + 0.05 || start < previousStart) {
      throw new Error(`Mốc của dòng ${index + 1} không hợp lệ.`);
    }
    previousStart = start;
    return { sp, ja, start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("latest") === "1") {
    try {
      const latest = await newestLesson();
      return NextResponse.json(await loadLesson(latest.exam, latest.lesson));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Không tìm được lesson mới nhất." }, { status: 500 });
    }
  }
  const exam = searchParams.get("exam");
  const lesson = searchParams.get("lesson");
  if (!validId(exam, lesson)) return NextResponse.json({ error: "Exam hoặc lesson không hợp lệ." }, { status: 400 });
  try {
    return NextResponse.json(await loadLesson(exam!, lesson!));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không tải được timing." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: string; exam?: string; lesson?: string; lines?: unknown };
    const { exam, lesson } = body;
    if (!validId(exam ?? null, lesson ?? null)) throw new Error("Exam hoặc lesson không hợp lệ.");
    const current = await loadLesson(exam!, lesson!);
    const target = overridePath(exam!, lesson!);

    if (body.action === "reset") {
      await unlink(target).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      return NextResponse.json(await loadLesson(exam!, lesson!));
    }

    const lines = validateLines(body.lines, current.duration);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify({ version: 1, exam, lesson, lines }, null, 2)}\n`, "utf8");
    if (body.action === "render") {
      await execFileAsync("python", [
        "scripts/n2_social_video.py", "--exam", exam!, "--lesson", lesson!, "--layout", "top-scroll", "--hook-intro", "--lyric-mode", "focus", "--focus-md-lines", "--timing-source", "clip", "--lyric-lead-seconds", "0",
      ], {
        cwd: root,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
    }
    const rendered = body.action === "render";
    const videoUrl = rendered ? `/audio/n2/${exam}/${lesson}.social.mp4` : null;
    const videoPath = rendered
      ? path.join(root, "public", "audio", "n2", exam!, `${lesson}.social.mp4`)
      : null;
    return NextResponse.json({ ok: true, rendered, videoUrl, videoPath });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lưu timing." }, { status: 400 });
  }
}
