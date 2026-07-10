"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

export function CreateCourseForm() {
  const { createCourse } = useData();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("N3-N2");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("コース名を入力してください。");
    const course = createCourse({
      title: title.trim(),
      description: description.trim() || null,
      topic: topic.trim() || null,
      level: level || null,
      accent,
      image_url: imageUrl.trim() || null,
    });
    router.push(`/courses/${course.slug ?? course.id}`);
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
            placeholder="このコースで学べる内容を簡単に。"
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
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            カバー画像URL（任意）
          </label>
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
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccent(c)}
                aria-label={`color ${c}`}
                className={[
                  "h-8 w-8 rounded-full transition-transform",
                  accent === c ? "ring-2 ring-offset-2 ring-offset-card scale-110" : "",
                ].join(" ")}
                style={{ background: c, boxShadow: `0 0 0 1px color-mix(in srgb, ${c} 40%, transparent)` }}
              />
            ))}
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          コースを作成
        </Button>
      </div>
    </form>
  );
}
