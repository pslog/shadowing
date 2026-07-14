"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Course } from "@/lib/types";

const LEVELS = ["N5", "N4", "N4-N3", "N3", "N3-N2", "N2", "N1"];
const ACCENTS = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
];

const field =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-ring";

export function CreateCourseForm({ course }: { course?: Course }) {
  const { createCourse, updateCourse } = useData();
  const router = useRouter();

  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [topic, setTopic] = useState(course?.topic ?? "");
  const [level, setLevel] = useState(course?.level ?? "N3-N2");
  const [accent, setAccent] = useState(course?.accent ?? ACCENTS[0]);
  const [imageUrl, setImageUrl] = useState(course?.image_url ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("コース名を入力してください。");

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      topic: topic.trim() || null,
      level: level || null,
      accent,
      image_url: imageUrl.trim() || null,
    };
    const saved = course ? updateCourse({ ...payload, id: course.id }) : createCourse(payload);
    router.push(`/courses/${saved.slug ?? saved.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">コース名 *</label>
          <input
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 会議で話す日本語"
            lang="ja"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">説明</label>
          <textarea
            className={`${field} min-h-20`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="このコースで学べる内容を簡単に入力してください。"
            lang="ja"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">トピック</label>
            <input
              className={field}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例: 会議"
              lang="ja"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">レベル</label>
            <select
              className={field}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {LEVELS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">カバー画像URL（任意）</label>
          <input
            className={field}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="/course-covers/xxx.jpg"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">アクセントカラー</label>
          <div className="flex gap-2">
            {ACCENTS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAccent(color)}
                aria-label={`カラー ${color}`}
                className={[
                  "h-8 w-8 rounded-full transition-transform",
                  accent === color ? "scale-110 ring-2 ring-offset-2 ring-offset-card" : "",
                ].join(" ")}
                style={{
                  background: color,
                  boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)`,
                }}
              />
            ))}
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          {course ? "コースを更新" : "コースを作成"}
        </Button>
      </div>
    </form>
  );
}
