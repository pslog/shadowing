#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const resourcesDir = path.join(rootDir, "resources");
const generatedDir = path.join(resourcesDir, "generated");
const whisperDir = path.join(generatedDir, "whisper");
const publicAudioDir = path.join(rootDir, "public", "audio", "lessons");

const args = process.argv.slice(2);
const lessonArg = readArg("--lesson") ?? readArg("-l") ?? "1";
const model = readArg("--model") ?? "tiny";
const language = readArg("--language") ?? "Japanese";
const forceWhisper = args.includes("--force-whisper");
const lessonNo = Number(lessonArg);
const lessonKey = String(lessonNo).padStart(2, "0");

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
    stdio: options.stdio ?? "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArgs.join(" ")} failed\n${result.stdout ?? ""}\n${
        result.stderr ?? ""
      }`,
    );
  }
  return result;
}

function normalizeJa(text) {
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .replace(/[、。！？!?「」『』（）()［］\[\]・･…‥,.\s]/g, "")
    .toLowerCase();
}

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function ensureExtractedLesson() {
  const lessonPath = path.join(generatedDir, `lesson-${lessonKey}.json`);
  if (existsSync(lessonPath)) return lessonPath;
  run("node", ["scripts/extract-resources.mjs", "--lesson", String(lessonNo)]);
  return lessonPath;
}

function ensureWhisperJson() {
  const whisperPath = path.join(whisperDir, `${lessonNo}.json`);
  if (existsSync(whisperPath) && !forceWhisper) return whisperPath;

  mkdirSync(whisperDir, { recursive: true });
  run(
    "python",
    [
      "-m",
      "whisper",
      path.join("resources", `${lessonNo}.m4a`),
      "--language",
      language,
      "--model",
      model,
      "--output_format",
      "json",
      "--output_dir",
      path.relative(rootDir, whisperDir),
      "--fp16",
      "False",
    ],
    { stdio: "inherit" },
  );
  return whisperPath;
}

function bodySegments(segments, sentenceCount) {
  if (segments.length <= sentenceCount) return segments;
  const [first, ...rest] = segments;
  const firstText = first.text ?? "";
  const looksLikeTitle =
    first.start <= 1 &&
    first.end <= 10 &&
    /第|課|アイサツ|あいさつ|紹介|訪問/u.test(firstText);
  return looksLikeTitle ? rest : segments;
}

function groupCost(expected, segmentGroup, expectedRatio, totalDuration) {
  const expectedText = normalizeJa(expected);
  const transcriptText = normalizeJa(segmentGroup.map((segment) => segment.text).join(""));
  const maxLen = Math.max(expectedText.length, transcriptText.length, 1);
  const editCost = levenshtein(expectedText, transcriptText) / maxLen;
  const lengthCost = Math.abs(expectedText.length - transcriptText.length) / maxLen;
  const duration =
    segmentGroup[segmentGroup.length - 1].end - segmentGroup[0].start;
  const durationRatio = totalDuration > 0 ? duration / totalDuration : 0;
  const durationCost = Math.abs(durationRatio - expectedRatio);
  return editCost * 0.65 + lengthCost * 0.25 + durationCost * 0.1;
}

function alignSegments(sentences, segments) {
  const m = segments.length;
  const n = sentences.length;
  if (m < n) {
    throw new Error(`Whisper returned only ${m} body segments for ${n} sentences`);
  }

  const expectedLengths = sentences.map((sentence) => normalizeJa(sentence.ja_text).length);
  const totalExpectedLength = expectedLengths.reduce((sum, length) => sum + length, 0);
  const totalDuration = segments[m - 1].end - segments[0].start;
  const costCache = new Map();
  const cost = (sentenceIndex, startIndex, endIndex) => {
    const key = `${sentenceIndex}:${startIndex}:${endIndex}`;
    if (costCache.has(key)) return costCache.get(key);
    const group = segments.slice(startIndex, endIndex + 1);
    const value = groupCost(
      sentences[sentenceIndex].ja_text,
      group,
      expectedLengths[sentenceIndex] / totalExpectedLength,
      totalDuration,
    );
    costCache.set(key, value);
    return value;
  };

  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  const back = Array.from({ length: n + 1 }, () => Array(m + 1).fill(null));
  dp[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = i; j <= m; j++) {
      for (let k = i - 1; k < j; k++) {
        if (!Number.isFinite(dp[i - 1][k])) continue;
        const candidate = dp[i - 1][k] + cost(i - 1, k, j - 1);
        if (candidate < dp[i][j]) {
          dp[i][j] = candidate;
          back[i][j] = k;
        }
      }
    }
  }

  const groups = [];
  let cursor = m;
  for (let i = n; i >= 1; i--) {
    const start = back[i][cursor];
    if (start == null) throw new Error("Could not align Whisper segments");
    groups.unshift(segments.slice(start, cursor));
    cursor = start;
  }
  return groups;
}

function cutClip(inputAudio, outputPath, start, end) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    start.toFixed(3),
    "-to",
    end.toFixed(3),
    "-i",
    inputAudio,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
  ]);
}

function main() {
  const lessonPath = ensureExtractedLesson();
  const whisperPath = ensureWhisperJson();
  const lesson = JSON.parse(readFileSync(lessonPath, "utf8"));
  const whisper = JSON.parse(readFileSync(whisperPath, "utf8"));
  const segments = bodySegments(whisper.segments, lesson.sentences.length);
  const groups = alignSegments(lesson.sentences, segments);

  const sourceAudio = path.join(resourcesDir, `${lessonNo}.m4a`);
  const lessonClipDir = path.join(publicAudioDir, `lesson-${lessonKey}`);

  const alignedSentences = lesson.sentences.map((sentence, index) => {
    const group = groups[index];
    const rawStart = group[0].start;
    const rawEnd = group[group.length - 1].end;
    const clipStart = Math.max(0, rawStart - 0.15);
    const clipEnd = rawEnd + 0.2;
    const clipName = `s${String(index + 1).padStart(2, "0")}.m4a`;
    const clipPath = path.join(lessonClipDir, clipName);
    cutClip(sourceAudio, clipPath, clipStart, clipEnd);
    return {
      ...sentence,
      audio_start: Number(rawStart.toFixed(3)),
      audio_end: Number(rawEnd.toFixed(3)),
      clip_url: `/audio/lessons/lesson-${lessonKey}/${clipName}`,
      clip_start: Number(clipStart.toFixed(3)),
      clip_end: Number(clipEnd.toFixed(3)),
      whisper_text: group.map((segment) => segment.text.trim()).join(""),
    };
  });

  const alignedLesson = {
    ...lesson,
    sentences: alignedSentences,
  };
  writeFileSync(lessonPath, JSON.stringify(alignedLesson, null, 2) + "\n", "utf8");

  const alignmentPath = path.join(generatedDir, `lesson-${lessonKey}.alignment.json`);
  writeFileSync(
    alignmentPath,
    JSON.stringify(
      {
        lesson_id: lesson.id,
        whisper_model: model,
        source_audio: `resources/${lessonNo}.m4a`,
        groups: alignedSentences.map((sentence, index) => ({
          order_index: index,
          audio_start: sentence.audio_start,
          audio_end: sentence.audio_end,
          clip_url: sentence.clip_url,
          ja_text: sentence.ja_text,
          whisper_text: sentence.whisper_text,
        })),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        lesson: lesson.lesson_no,
        sentence_count: alignedSentences.length,
        updated_data: path.relative(rootDir, lessonPath),
        alignment: path.relative(rootDir, alignmentPath),
        clips_dir: path.relative(rootDir, lessonClipDir),
      },
      null,
      2,
    ),
  );
}

main();
