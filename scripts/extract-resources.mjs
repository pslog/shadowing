#!/usr/bin/env node

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const resourcesDir = path.join(rootDir, "resources");
const markdownPath = path.join(resourcesDir, "lesson.md");
const generatedDir = path.join(resourcesDir, "generated");
const publicAudioDir = path.join(rootDir, "public", "audio", "lessons");

const args = process.argv.slice(2);
const lessonArg = readArg("--lesson") ?? readArg("-l") ?? "1";
const extractAll = args.includes("--all");

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function padLessonNo(no) {
  return String(no).padStart(2, "0");
}

function normalizeText(line) {
  return line.replace(/\s+/g, " ").trim();
}

function parseLessons(markdown) {
  const lines = markdown
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim());

  const lessons = [];
  let current = null;

  for (const line of lines) {
    if (!line) continue;

    const titleMatch = line.match(/^第(\d+)課\s*[–-]\s*(.+)$/u);
    if (titleMatch) {
      current = {
        lesson_no: Number(titleMatch[1]),
        title: line,
        subtitle: titleMatch[2].trim(),
        body: [],
      };
      lessons.push(current);
      continue;
    }

    if (!current) {
      throw new Error(`Found content before first lesson title: ${line}`);
    }
    current.body.push(line);
  }

  return lessons;
}

function buildLesson(lesson) {
  if (lesson.body.length % 2 !== 0) {
    throw new Error(
      `Lesson ${lesson.lesson_no} has an odd number of content lines: ${lesson.body.length}`,
    );
  }

  const sentences = [];
  for (let i = 0; i < lesson.body.length; i += 2) {
    sentences.push({
      order_index: i / 2,
      ja_text: normalizeText(lesson.body[i]),
      vi_translation: normalizeText(lesson.body[i + 1]),
      audio_start: null,
      audio_end: null,
      pass_score: 80,
    });
  }

  const lessonNo = padLessonNo(lesson.lesson_no);
  return {
    id: `resource-lesson-${lessonNo}`,
    lesson_no: lesson.lesson_no,
    title: lesson.title,
    topic: inferTopic(lesson.subtitle),
    level: "N3-N2",
    source_type: "upload",
    source_url: null,
    media_url: `/audio/lessons/lesson-${lessonNo}.m4a`,
    audio_source: `resources/${lesson.lesson_no}.m4a`,
    sentences,
  };
}

function inferTopic(subtitle) {
  if (subtitle.includes("キックオフ")) return "キックオフ";
  if (subtitle.includes("初回訪問") || subtitle.includes("あいさつ")) return "敬語";
  if (subtitle.includes("進捗")) return "進捗報告";
  if (subtitle.includes("要件")) return "要件定義";
  return "会話";
}

function copyAudioForLesson(lesson) {
  const source = path.join(resourcesDir, `${lesson.lesson_no}.m4a`);
  const lessonNo = padLessonNo(lesson.lesson_no);
  const target = path.join(publicAudioDir, `lesson-${lessonNo}.m4a`);
  mkdirSync(publicAudioDir, { recursive: true });
  copyFileSync(source, target);
  return target;
}

function main() {
  mkdirSync(generatedDir, { recursive: true });

  const rawLessons = parseLessons(readFileSync(markdownPath, "utf8"));
  const selected = extractAll
    ? rawLessons.map(buildLesson)
    : rawLessons
        .filter((lesson) => lesson.lesson_no === Number(lessonArg))
        .map(buildLesson);

  if (selected.length === 0) {
    throw new Error(`No lesson found for --lesson ${lessonArg}`);
  }

  const outputs = [];
  for (const lesson of selected) {
    copyAudioForLesson(lesson);
    const lessonNo = padLessonNo(lesson.lesson_no);
    const outputPath = path.join(generatedDir, `lesson-${lessonNo}.json`);
    writeFileSync(outputPath, JSON.stringify(lesson, null, 2) + "\n", "utf8");
    outputs.push(outputPath);
  }

  if (extractAll) {
    const allOutputPath = path.join(generatedDir, "lessons.json");
    writeFileSync(allOutputPath, JSON.stringify(selected, null, 2) + "\n", "utf8");
    outputs.push(allOutputPath);
  }

  console.log(
    JSON.stringify(
      {
        extracted_lessons: selected.map((lesson) => lesson.lesson_no),
        generated_files: outputs.map((file) => path.relative(rootDir, file)),
        copied_audio: selected.map(
          (lesson) => `public/audio/lessons/lesson-${padLessonNo(lesson.lesson_no)}.m4a`,
        ),
      },
      null,
      2,
    ),
  );
}

main();
