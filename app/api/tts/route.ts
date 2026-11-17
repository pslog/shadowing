import { EdgeTTS } from "@andresaya/edge-tts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { text, voice, rate } = await request.json();
    if (typeof text !== "string" || !text.trim() || text.length > 2000 || typeof voice !== "string" || (!["ja-JP-NanamiNeural", "ja-JP-KeitaNeural"].includes(voice) && !/^voicevox:\d{1,6}$/.test(voice))) {
      return Response.json({ error: "Nội dung hoặc giọng đọc không hợp lệ." }, { status: 400 });
    }
    const speed = typeof rate === "number" && Number.isFinite(rate) ? Math.max(0.5, Math.min(1.5, rate)) : 1;
    if (voice.startsWith("voicevox:")) {
      const speaker = voice.slice("voicevox:".length);
      const queryUrl = new URL("http://127.0.0.1:50021/audio_query");
      queryUrl.searchParams.set("text", text); queryUrl.searchParams.set("speaker", speaker);
      const queryResponse = await fetch(queryUrl, { method: "POST", signal: AbortSignal.timeout(30000) });
      if (!queryResponse.ok) throw new Error("VOICEVOX audio query failed");
      const query = await queryResponse.json(); query.speedScale = speed;
      const audioResponse = await fetch(`http://127.0.0.1:50021/synthesis?speaker=${speaker}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query), signal: AbortSignal.timeout(120000) });
      if (!audioResponse.ok) throw new Error("VOICEVOX synthesis failed");
      return new Response(await audioResponse.arrayBuffer(), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
    }
    const result = await new EdgeTTS().generate(text, voice, { rate: `${Math.round((speed - 1) * 100)}%` });
    return new Response(new Uint8Array(result.audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Neural TTS error:", error);
    return Response.json({ error: "Không tạo được âm thanh. Hãy kiểm tra kết nối Microsoft hoặc VOICEVOX và thử lại." }, { status: 502 });
  }
}
