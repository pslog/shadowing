import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const examPattern = /^\d{4}-\d{2}$/;
const lessonPattern = /^m[1-9]\d*-q[1-9]\d*$/;
const allowedTypes = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const exam = String(form.get("exam") ?? "");
    const lesson = String(form.get("lesson") ?? "");
    const image = form.get("image");
    if (!examPattern.test(exam) || !lessonPattern.test(lesson)) throw new Error("Exam hoặc lesson không hợp lệ.");
    if (!(image instanceof File) || image.size === 0) throw new Error("Chọn một ảnh nền trước đã.");
    if (image.size > 12 * 1024 * 1024) throw new Error("Ảnh nền tối đa 12 MB.");
    const extension = allowedTypes.get(image.type);
    if (!extension) throw new Error("Chỉ nhận PNG, JPG hoặc WebP.");

    const directory = path.join(process.cwd(), "public", "audio", "n2", exam);
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, `${lesson}-bg${extension}`);
    await writeFile(target, Buffer.from(await image.arrayBuffer()));
    await Promise.all(
      [...allowedTypes.values()]
        .filter((candidate) => candidate !== extension)
        .map((candidate) => unlink(path.join(directory, `${lesson}-bg${candidate}`)).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        })),
    );
    return NextResponse.json({ backgroundUrl: `/audio/n2/${exam}/${lesson}-bg${extension}?v=${Date.now()}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể cập nhật ảnh nền." }, { status: 400 });
  }
}
