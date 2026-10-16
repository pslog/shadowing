const SPEAKER_COLORS = [
  "var(--c-indigo)",
  "var(--c-rose)",
  "var(--c-emerald)",
  "var(--c-amber)",
  "var(--c-sky)",
  "var(--c-violet)",
];

/** Small colored chip naming a dialogue speaker ("A", "B", ...). Renders nothing for narration. */
export function SpeakerBadge({
  speaker,
  label,
  className = "",
}: {
  speaker: string | null | undefined;
  label: (speaker: string) => string;
  className?: string;
}) {
  if (!speaker) return null;
  const code = speaker.toUpperCase().charCodeAt(0) - 65;
  const color = SPEAKER_COLORS[((code % SPEAKER_COLORS.length) + SPEAKER_COLORS.length) % SPEAKER_COLORS.length];
  return (
    <span
      title={label(speaker)}
      aria-label={label(speaker)}
      className={`inline-grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] font-extrabold leading-none ${className}`}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)` }}
    >
      {speaker}
    </span>
  );
}
