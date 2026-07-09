"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Course,
  Lesson,
  LessonSentence,
  Profile,
  ScoreBreakdown,
} from "@/lib/types";
import { createClient as createSupabaseClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { applyAttempt, type AttemptOutcome } from "./engine";
import { buildSeed, emptyState, STORAGE_KEY, uid, type AppState } from "./state";

export interface LoginInput {
  email: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface CreateLessonInput {
  title: string;
  topic: string | null;
  level: string | null;
  course_id: string | null;
  source_url: string | null;
  media_url: string | null;
  duration_seconds: number | null;
  sentences: {
    ja_text: string;
    vi_translation: string | null;
  }[];
}

export interface UpdateLessonInput extends CreateLessonInput {
  id: string;
}

export interface CreateCourseInput {
  title: string;
  description: string | null;
  topic: string | null;
  level: string | null;
  accent: string | null;
  image_url: string | null;
}

export interface RecordAttemptInput {
  sentenceId: string;
  score: ScoreBreakdown;
  recordingUrl: string | null;
  transcript: string | null;
  userDurationSeconds: number | null;
}

interface DataContextValue {
  state: AppState;
  ready: boolean;
  usingSupabase: boolean;
  login: (input: LoginInput) => Promise<Profile | null>;
  logout: () => void;
  createCourse: (input: CreateCourseInput) => Course;
  createLesson: (input: CreateLessonInput) => Lesson;
  updateLesson: (input: UpdateLessonInput) => Lesson;
  updateSentenceTiming: (
    sentenceId: string,
    audioStart: number | null,
    audioEnd: number | null,
  ) => void;
  recordAttempt: (input: RecordAttemptInput) => AttemptOutcome;
  reset: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);
const USING_SUPABASE = hasSupabaseEnv();

function migrateSeedContent(state: AppState): AppState {
  const seed = buildSeed(new Date().toISOString());
  const seedCourseIds = new Set(seed.courses.map((course) => course.id));
  const seedLessonIds = new Set(seed.lessons.map((lesson) => lesson.id));
  const seedSentenceIds = new Set(seed.sentences.map((sentence) => sentence.id));

  // Drop any seed course from old blobs (they're rebuilt fresh from buildSeed).
  const customCourses = (state.courses ?? []).filter(
    (course) => !seedCourseIds.has(course.id) && !course.id.startsWith("seed-course-"),
  );
  const customLessons = state.lessons
    .filter((lesson) => !seedLessonIds.has(lesson.id))
    // Backfill course_id; drop references to removed local seed courses.
    .map((lesson) => ({
      ...lesson,
      course_id: lesson.course_id?.startsWith("seed-course-")
        ? null
        : lesson.course_id ?? null,
    }));
  const customSentences = state.sentences.filter(
    (sentence) => !seedSentenceIds.has(sentence.id),
  );

  return {
    ...state,
    courses: [...seed.courses, ...customCourses],
    lessons: [...seed.lessons, ...customLessons],
    sentences: [...seed.sentences, ...customSentences],
  };
}

function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? migrateSeedContent(JSON.parse(raw) as AppState)
      : emptyState(new Date().toISOString());
  } catch {
    return emptyState(new Date().toISOString());
  }
}

function profileFromUser(
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  fallback?: Profile | null,
): Profile {
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email?.split("@")[0] ?? "学習者";
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null;
  const now = new Date().toISOString();

  return {
    id: user.id,
    email: user.email ?? fallback?.email ?? "",
    display_name: displayName,
    avatar_url: avatarUrl,
    total_xp: fallback?.total_xp ?? 0,
    current_level: fallback?.current_level ?? 1,
    current_streak: fallback?.current_streak ?? 0,
    longest_streak: fallback?.longest_streak ?? 0,
    last_completed_date: fallback?.last_completed_date ?? null,
    created_at: fallback?.created_at ?? now,
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() =>
    emptyState(new Date(0).toISOString()),
  );
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const stateRef = useRef<AppState>(state);

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const loadSupabaseState = useCallback(async (): Promise<AppState> => {
    const supabase = createSupabaseClient();
    if (!supabase) return loadLocalState();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let profile: Profile | null = null;
    if (user) {
      const fallbackProfile = profileFromUser(user);
      await supabase.from("profiles").upsert({
        id: fallbackProfile.id,
        email: fallbackProfile.email,
        display_name: fallbackProfile.display_name,
        avatar_url: fallbackProfile.avatar_url,
      });

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = profileFromUser(user, data as Profile | null);
    }

    const [
      coursesResult,
      lessonsResult,
      sentencesResult,
      attemptsResult,
      progressResult,
      missionsResult,
      xpEventsResult,
    ] = await Promise.all([
      supabase
        .from("courses")
        .select("*")
        .order("order_index", { ascending: true })
        .then((r) => r, () => ({ data: [], error: null })),
      supabase.from("lessons").select("*").order("title", { ascending: true }),
      supabase
        .from("lesson_sentences")
        .select("*")
        .order("lesson_id", { ascending: true })
        .order("order_index", { ascending: true }),
      user
        ? supabase
            .from("sentence_attempts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      user
        ? supabase.from("lesson_progress").select("*").eq("user_id", user.id)
        : Promise.resolve({ data: [], error: null }),
      user
        ? supabase.from("daily_missions").select("*").eq("user_id", user.id)
        : Promise.resolve({ data: [], error: null }),
      user
        ? supabase
            .from("xp_events")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (lessonsResult.error) throw lessonsResult.error;
    if (sentencesResult.error) throw sentencesResult.error;

    return {
      profile,
      courses: (coursesResult.data ?? []) as Course[],
      lessons: (lessonsResult.data ?? []) as Lesson[],
      sentences: (sentencesResult.data ?? []) as LessonSentence[],
      attempts: (attemptsResult.data ?? []) as AppState["attempts"],
      progress: (progressResult.data ?? []) as AppState["progress"],
      missions: (missionsResult.data ?? []) as AppState["missions"],
      xpEvents: (xpEventsResult.data ?? []) as AppState["xpEvents"],
    };
  }, []);

  const persistSupabaseLesson = useCallback(
    async (lesson: Lesson, sentences: LessonSentence[]) => {
      const supabase = createSupabaseClient();
      if (!supabase) return;

      const { error: lessonError } = await supabase.from("lessons").upsert(lesson);
      if (lessonError) throw lessonError;

      const { error: deleteError } = await supabase
        .from("lesson_sentences")
        .delete()
        .eq("lesson_id", lesson.id);
      if (deleteError) throw deleteError;

      if (sentences.length > 0) {
        const { error } = await supabase.from("lesson_sentences").insert(sentences);
        if (error) throw error;
      }
    },
    [],
  );

  const persistSupabaseOutcome = useCallback(
    async (next: AppState, outcome: AttemptOutcome) => {
      const supabase = createSupabaseClient();
      if (!supabase || !next.profile) return;

      const progress = next.progress.find(
        (item) =>
          item.user_id === next.profile?.id &&
          item.lesson_id === outcome.attempt.lesson_id,
      );
      const mission = next.missions.find(
        (item) =>
          item.user_id === next.profile?.id &&
          item.mission_date === outcome.attempt.created_at.slice(0, 10),
      );
      const newXpEvents = next.xpEvents.filter(
        (item) => item.created_at === outcome.attempt.created_at,
      );

      const writes = [
        supabase.from("sentence_attempts").insert(outcome.attempt),
        supabase
          .from("profiles")
          .update({
            total_xp: next.profile.total_xp,
            current_level: next.profile.current_level,
            current_streak: next.profile.current_streak,
            longest_streak: next.profile.longest_streak,
            last_completed_date: next.profile.last_completed_date,
          })
          .eq("id", next.profile.id),
        progress
          ? supabase.from("lesson_progress").upsert(progress)
          : Promise.resolve({ error: null }),
        mission
          ? supabase.from("daily_missions").upsert(mission)
          : Promise.resolve({ error: null }),
        newXpEvents.length > 0
          ? supabase.from("xp_events").insert(newXpEvents)
          : Promise.resolve({ error: null }),
      ];

      const results = await Promise.all(writes);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      let next: AppState;
      try {
        next = USING_SUPABASE ? await loadSupabaseState() : loadLocalState();
      } catch {
        next = loadLocalState();
      }

      if (cancelled) return;
      stateRef.current = next;
      setState(next);
      hydrated.current = true;
      setReady(true);
    }

    hydrate();

    const supabase = createSupabaseClient();
    const subscription = supabase?.auth.onAuthStateChange(() => {
      loadSupabaseState()
        .then((next) => {
          if (!cancelled) commit(next);
        })
        .catch(() => undefined);
    }).data.subscription;

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [commit, loadSupabaseState]);

  useEffect(() => {
    if (!hydrated.current || USING_SUPABASE) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode - non-fatal */
    }
  }, [state]);

  const login = useCallback(
    async (input: LoginInput): Promise<Profile | null> => {
      const supabase = createSupabaseClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        return null;
      }

      const prev = stateRef.current;
      const existing = prev.profile;
      if (existing && existing.email === input.email) return existing;

      const now = new Date().toISOString();
      const profile: Profile = {
        id: existing?.id ?? uid(),
        email: input.email,
        display_name: input.display_name,
        avatar_url: input.avatar_url ?? null,
        total_xp: existing?.total_xp ?? 0,
        current_level: existing?.current_level ?? 1,
        current_streak: existing?.current_streak ?? 0,
        longest_streak: existing?.longest_streak ?? 0,
        last_completed_date: existing?.last_completed_date ?? null,
        created_at: existing?.created_at ?? now,
      };
      commit({ ...prev, profile });
      return profile;
    },
    [commit],
  );

  const logout = useCallback(() => {
    createSupabaseClient()?.auth.signOut();
    commit({ ...stateRef.current, profile: null });
  }, [commit]);

  const createCourse = useCallback(
    (input: CreateCourseInput): Course => {
      const prev = stateRef.current;
      if (!prev.profile) throw new Error("Must be logged in to create a course");
      const now = new Date().toISOString();
      const course: Course = {
        id: uid(),
        user_id: prev.profile.id,
        title: input.title,
        description: input.description,
        topic: input.topic,
        level: input.level,
        accent: input.accent,
        image_url: input.image_url,
        order_index: prev.courses.length,
        is_public: false,
        created_at: now,
      };
      commit({ ...prev, courses: [...prev.courses, course] });
      if (USING_SUPABASE) {
        createSupabaseClient()
          ?.from("courses")
          .upsert(course)
          .then(undefined, console.error);
      }
      return course;
    },
    [commit],
  );

  const createLesson = useCallback(
    (input: CreateLessonInput): Lesson => {
      const prev = stateRef.current;
      if (!prev.profile) throw new Error("Must be logged in to create a lesson");
      const now = new Date().toISOString();
      const lesson: Lesson = {
        id: uid(),
        user_id: prev.profile.id,
        course_id: input.course_id,
        title: input.title,
        topic: input.topic,
        level: input.level,
        duration_seconds: input.duration_seconds,
        source_type: input.source_url ? "youtube" : "upload",
        source_url: input.source_url,
        media_url: input.media_url,
        is_public: false,
        created_at: now,
      };
      const sentences: LessonSentence[] = input.sentences.map((s, i) => ({
        id: uid(),
        lesson_id: lesson.id,
        order_index: i,
        ja_text: s.ja_text,
        vi_translation: s.vi_translation,
        audio_url: null,
        audio_start: null,
        audio_end: null,
        pass_score: 80,
        created_at: now,
      }));
      commit({
        ...prev,
        lessons: [...prev.lessons, lesson],
        sentences: [...prev.sentences, ...sentences],
      });
      if (USING_SUPABASE) persistSupabaseLesson(lesson, sentences).catch(console.error);
      return lesson;
    },
    [commit, persistSupabaseLesson],
  );

  const updateLesson = useCallback(
    (input: UpdateLessonInput): Lesson => {
      const prev = stateRef.current;
      if (!prev.profile) throw new Error("Must be logged in to update a lesson");

      const existing = prev.lessons.find((lesson) => lesson.id === input.id);
      if (!existing) throw new Error("Lesson not found");

      const now = new Date().toISOString();
      const lesson: Lesson = {
        ...existing,
        course_id: input.course_id,
        title: input.title,
        topic: input.topic,
        level: input.level,
        duration_seconds: input.duration_seconds,
        source_type: input.source_url ? "youtube" : "upload",
        source_url: input.source_url,
        media_url: input.media_url,
      };
      const existingSentences = prev.sentences
        .filter((sentence) => sentence.lesson_id === input.id)
        .sort((a, b) => a.order_index - b.order_index);
      const nextSentenceIds = new Set<string>();
      const nextLessonSentences: LessonSentence[] = input.sentences.map((s, i) => {
        const existingSentence = existingSentences[i];
        const id = existingSentence?.id ?? uid();
        nextSentenceIds.add(id);
        return {
          id,
          lesson_id: lesson.id,
          order_index: i,
          ja_text: s.ja_text,
          vi_translation: s.vi_translation,
          audio_url: existingSentence?.audio_url ?? null,
          audio_start: existingSentence?.audio_start ?? null,
          audio_end: existingSentence?.audio_end ?? null,
          pass_score: existingSentence?.pass_score ?? 80,
          created_at: existingSentence?.created_at ?? now,
        };
      });

      commit({
        ...prev,
        lessons: prev.lessons.map((item) => (item.id === lesson.id ? lesson : item)),
        sentences: [
          ...prev.sentences.filter((sentence) => sentence.lesson_id !== lesson.id),
          ...nextLessonSentences,
        ],
        attempts: prev.attempts.filter(
          (attempt) =>
            attempt.lesson_id !== lesson.id || nextSentenceIds.has(attempt.sentence_id),
        ),
        progress: prev.progress.map((progress) =>
          progress.lesson_id === lesson.id
            ? {
                ...progress,
                total_sentence_count: nextLessonSentences.length,
                passed_sentence_count: Math.min(
                  progress.passed_sentence_count,
                  nextLessonSentences.length,
                ),
                updated_at: now,
              }
            : progress,
        ),
      });
      if (USING_SUPABASE) {
        persistSupabaseLesson(lesson, nextLessonSentences).catch(console.error);
      }
      return lesson;
    },
    [commit, persistSupabaseLesson],
  );

  const updateSentenceTiming = useCallback(
    (sentenceId: string, audioStart: number | null, audioEnd: number | null) => {
      const prev = stateRef.current;
      commit({
        ...prev,
        sentences: prev.sentences.map((s) =>
          s.id === sentenceId
            ? { ...s, audio_start: audioStart, audio_end: audioEnd }
            : s,
        ),
      });
      if (USING_SUPABASE) {
        createSupabaseClient()
          ?.from("lesson_sentences")
          .update({ audio_start: audioStart, audio_end: audioEnd })
          .eq("id", sentenceId)
          .then(undefined, console.error);
      }
    },
    [commit],
  );

  const recordAttempt = useCallback(
    (input: RecordAttemptInput): AttemptOutcome => {
      const prev = stateRef.current;
      const now = new Date().toISOString();
      const { state: next, outcome } = applyAttempt(prev, input, now);
      commit(next);
      if (USING_SUPABASE) persistSupabaseOutcome(next, outcome).catch(console.error);
      return outcome;
    },
    [commit, persistSupabaseOutcome],
  );

  const reset = useCallback(() => {
    const next = emptyState(new Date().toISOString());
    commit(next);
    if (!USING_SUPABASE) localStorage.removeItem(STORAGE_KEY);
  }, [commit]);

  const value = useMemo<DataContextValue>(
    () => ({
      state,
      ready,
      usingSupabase: USING_SUPABASE,
      login,
      logout,
      createCourse,
      createLesson,
      updateLesson,
      updateSentenceTiming,
      recordAttempt,
      reset,
    }),
    [
      state,
      ready,
      login,
      logout,
      createCourse,
      createLesson,
      updateLesson,
      updateSentenceTiming,
      recordAttempt,
      reset,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}
