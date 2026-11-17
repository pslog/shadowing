export const runtime = "nodejs";
export async function GET() {
  try {
    const response = await fetch("http://127.0.0.1:50021/speakers", { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("VOICEVOX unavailable");
    const speakers: { name: string; styles: { name: string; id: number; type?: string }[] }[] = await response.json();
    return Response.json(speakers.flatMap(speaker => speaker.styles.filter(style => !style.type || style.type === "talk" || style.type === "streaming_talk").map(style => ({ id: style.id, name: speaker.name, style: style.name }))));
  } catch {
    return Response.json({ error: "Chưa kết nối được VOICEVOX." }, { status: 503 });
  }
}
