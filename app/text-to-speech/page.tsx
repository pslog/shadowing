"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./style.css";
import { parseScript, type Line } from "@/lib/tts/parse";
import { wavFromAudio, zipFiles } from "@/lib/tts/export";

const recommendedVoices: Record<number, string> = { 8: "Tsumugi · Nữ", 10: "Hau · Nữ", 13: "Ryusei · Nam", 11: "Takehiro · Nam" };

const sample = `# title: 第16課 – お客様のお出迎えと移動中の会話
# title_vi: Đón khách và trò chuyện trên đường di chuyển
# topic: 雑談・敬語
# level: N2
speaker	ja	vi
an	小巻様、黒田様、お疲れさまでございます。長旅でお疲れのところ、ようこそベトナムへお越しくださいました。DKHのアンです。本日は私がお迎えに参りました。	Anh Komaki, anh Kuroda, hai anh đã vất vả rồi ạ. Rất hoan nghênh hai anh đến Việt Nam sau chuyến đi dài. Tôi là An đến từ DKH. Hôm nay tôi đến sân bay để đón hai anh.
komaki	アンさん、お久しぶりです。わざわざ空港まで迎えに来ていただいて、ありがとうございます。おかげさまで、迷わず合流できました.	Anh An, lâu rồi không gặp. Cảm ơn anh đã cất công ra tận sân bay đón chúng tôi. Nhờ vậy mà chúng tôi có thể gặp anh ngay mà không phải mất công tìm kiếm.
an	とんでもございません。お二人とも、フライトはいかがでしたか。長時間の移動でお疲れではありませんか。	Dạ, không có gì đâu ạ. Chuyến bay của hai anh thế nào ạ? Di chuyển đường dài như vậy chắc hai anh cũng mệt rồi nhỉ?`;

export default function TextToSpeechPage() {
  const [input, setInput] = useState(sample);
  const [lines, setLines] = useState<Line[]>(() => parseScript(sample));
  const [showAllVoices, setShowAllVoices] = useState(false);
  const [voicevox, setVoicevox] = useState<{id: number; name: string; style: string}[]>([]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [rate, setRate] = useState(0.9);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);
  const [message, setMessage] = useState("");
  const [parsedInput, setParsedInput] = useState(sample);
  const [exporting, setExporting] = useState(false);
  const exportAbort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const speakers = useMemo(() => ["Người dẫn", ...Array.from(new Set(lines.filter(l => l.kind === "dialogue").map(l => l.speaker)))], [lines]);
  const jpVoices = useMemo(() => voices.filter(v => /^ja(?:-|_)/i.test(v.lang)), [voices]);

  useEffect(() => {
    fetch("/api/tts/voices").then(response => response.ok ? response.json() : []).then(setVoicevox).catch(() => setVoicevox([]));
    if (!("speechSynthesis" in window)) { setSupported(false); return; }
    const synth = window.speechSynthesis;
    const refresh = () => setVoices(synth.getVoices());
    refresh(); synth.addEventListener("voiceschanged", refresh);
    return () => { generation.current++; exportAbort.current?.abort(); requestRef.current?.abort(); audioRef.current?.pause(); if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); synth.cancel(); synth.removeEventListener("voiceschanged", refresh); };
  }, []);
  function stop() { generation.current++; requestRef.current?.abort(); audioRef.current?.pause(); audioRef.current = null; if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; window.speechSynthesis?.cancel(); setPlaying(false); setActive(null); }
  function play(queue: Line[]) {
    if (!supported || !queue.length) return;
    stop(); setMessage("");
    const current = generation.current;
    setPlaying(true);
    const next = async (index: number) => {
      if (generation.current !== current) return;
      if (index >= queue.length) { setPlaying(false); setActive(null); return; }
      const line = queue[index];
      const choice = selected[line.speaker] || (speakers.indexOf(line.speaker) === 2 ? "ja-JP-KeitaNeural" : "ja-JP-NanamiNeural");
      setActive(line.id);
      if ((choice.startsWith("ja-JP-") && choice.endsWith("Neural")) || choice.startsWith("voicevox:")) {
        const controller = new AbortController(); requestRef.current = controller;
        try {
          const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: line.text, voice: choice, rate }), signal: controller.signal });
          if (!response.ok) throw new Error("tts unavailable");
          const blob = await response.blob();
          if (generation.current !== current) return;
          const url = URL.createObjectURL(blob); audioUrlRef.current = url; const audio = new Audio(url); audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); if (audioUrlRef.current === url) audioUrlRef.current = null; if (audioRef.current === audio) audioRef.current = null; void next(index + 1); };
          audio.onerror = () => { URL.revokeObjectURL(url); if (generation.current === current) { setPlaying(false); setActive(null); setMessage("Không thể phát âm thanh. Vui lòng thử lại."); } };
          await audio.play();
        } catch (error) {
          if (generation.current === current && !(error instanceof DOMException && error.name === "AbortError")) { setPlaying(false); setActive(null); setMessage("Không tạo được âm thanh. Hãy kiểm tra kết nối Microsoft hoặc VOICEVOX rồi thử lại."); }
        }
        return;
      }
      const utterance = new SpeechSynthesisUtterance(line.text);
      const chosen = jpVoices.find(v => v.voiceURI === choice.replace(/^device:/, "")) || jpVoices[0];
      if (chosen) utterance.voice = chosen;
      utterance.lang = "ja-JP"; utterance.rate = rate;
      utterance.onend = () => { void next(index + 1); };
      utterance.onerror = (event) => { if (generation.current === current) { setPlaying(false); setActive(null); if (event.error !== "canceled" && event.error !== "interrupted") setMessage("Không thể phát giọng đọc. Hãy kiểm tra giọng tiếng Nhật trên thiết bị."); } };
      window.speechSynthesis.speak(utterance);
    };
    next(0);
  }
  function convert() { stop(); const parsed = parseScript(input); setLines(parsed); setParsedInput(input); const rowCount = input.split(/\r?\n/).filter(row => row.includes("\t") && !/^\s*speaker\s*\t/i.test(row)).length; const count = parsed.filter(line => line.kind === "dialogue").length; setMessage(parsed.length ? `Đã nhận ${count} lời thoại${rowCount > count ? `; ${rowCount - count} dòng không hợp lệ hoặc không có tiếng Nhật.` : "."}` : "Chưa tìm thấy nội dung tiếng Nhật hoặc lời thoại hợp lệ."); }
  async function exportAudio() {
    if (input !== parsedInput) { setMessage("Nội dung đã thay đổi. Hãy nhấn Tạo hội thoại trước khi xuất."); return; }
    const exportLines = lines.filter(line => line.filename);
    const sourceRows = parsedInput.split(/\r?\n/).filter(row => row.includes("\t") && !/^\s*speaker\s*\t/i.test(row)).length;
    if (sourceRows && sourceRows !== exportLines.filter(line => line.kind === "dialogue").length) { setMessage("Có dòng dữ liệu không hợp lệ. Hãy kiểm tra các cột speaker và ja trước khi xuất."); return; }
    if (!exportLines.some(line => line.kind === "title")) { setMessage("Cần có tiêu đề tiếng Nhật để tạo title.wav."); return; }
    if (exportLines.some(line => (selected[line.speaker] || "").startsWith("device:"))) { setMessage("Xuất WAV chỉ hỗ trợ giọng Microsoft và VOICEVOX. Hãy đổi các vai đang dùng giọng thiết bị."); return; }
    stop(); setExporting(true); const controller = new AbortController(); exportAbort.current = controller;
    const files: {name: string; data: Uint8Array}[] = [];
    const context = new AudioContext();
    try {
      for (let i = 0; i < exportLines.length; i++) {
        const line = exportLines[i]; setMessage(`Đang tạo ${line.filename} (${i + 1}/${exportLines.length})…`);
        const voice = selected[line.speaker] || (speakers.indexOf(line.speaker) === 2 ? "ja-JP-KeitaNeural" : "ja-JP-NanamiNeural");
        let response: Response | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: line.text, voice, rate }), signal: controller.signal });
          if (response.ok) break;
          if (response.status !== 429 && response.status !== 502) break;
          if (attempt < 2) await new Promise<void>((resolve, reject) => { const timer = window.setTimeout(resolve, 1500 * (attempt + 1)); controller.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true }); });
        }
        if (!response?.ok) throw new Error(`Không tạo được ${line.filename}. Hãy kiểm tra VOICEVOX hoặc thử lại nếu dịch vụ Microsoft đang giới hạn lượt gọi.`);
        const audio = await context.decodeAudioData(await response.arrayBuffer());
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        files.push({ name: line.filename, data: wavFromAudio(audio) });
      }
      const bytes = zipFiles(files); const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], {type: "application/zip"}));
      const link = document.createElement("a"); link.href = url; link.download = "hoi-thoai-wav.zip"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage(`Đã tạo ${files.length} tệp WAV trong file ZIP.`);
    } catch (error) { setMessage(error instanceof DOMException && error.name === "AbortError" ? "Đã hủy xuất âm thanh." : error instanceof Error ? error.message : "Không thể xuất âm thanh."); }
    finally { exportAbort.current = null; setExporting(false); await context.close(); }
  }
  return <main className="tts-page">
    <header className="tts-header"><a href="/vi" className="tts-brand"><span>音</span> Shadowing <b>JP</b></a><span className="tts-header-label">CÔNG CỤ LUYỆN NGHE</span><a href="/vi" className="tts-home">← Trang chủ</a></header>
    <div className="tts-wrap">
      <div className="tts-intro"><div><div className="tts-eyebrow"><span /> PHÒNG LUYỆN NGHE CỦA BẠN</div><h1>Biến hội thoại thành <em>âm thanh.</em></h1><p>Dán bài hội thoại tiếng Nhật, chọn giọng cho từng nhân vật và bắt đầu luyện nghe theo cách của bạn.</p></div><div className="tts-badge"><span>✳</span><div><b>Miễn phí</b><small>Giọng neural tiếng Nhật</small></div></div></div>
      <div className="tts-grid"><section className="tts-panel tts-editor"><div className="tts-section-heading"><div><span className="tts-kicker">BƯỚC 01</span><h2>Nội dung của bạn</h2></div><span className="tts-icon">✎</span></div><p>Dán dữ liệu có tiêu đề và các cột speaker, ja, vi vào bên dưới.</p><label className="tts-label" htmlFor="source">VĂN BẢN HỘI THOẠI <span>Tiếng Nhật</span></label><textarea id="source" disabled={exporting} value={input} onChange={e => setInput(e.target.value)} spellCheck={false} /><div className="tts-editor-bottom"><span>Các cột cách nhau bằng tab: <b>speaker · ja · vi</b></span><button className="tts-primary" disabled={exporting} onClick={convert}>Tạo hội thoại <span>→</span></button></div><div className="tts-tip"><span>✧</span><div><b>Mẹo nhỏ</b><p>Trang đọc # title và cột ja; cột vi cùng các metadata khác không được đọc.</p></div></div></section>
      <section className="tts-panel tts-voices"><div className="tts-section-heading"><div><span className="tts-kicker">BƯỚC 02</span><h2>Phân vai giọng đọc</h2></div><span className="tts-icon">♫</span></div><p>Thử Nanami, Keita hoặc 4 giọng gợi ý. Nhấn “Nghe thử” để nghe chính lời thoại của từng vai.</p>{voicevox.length > 0 && <label className="tts-show-all"><input type="checkbox" checked={showAllVoices} disabled={exporting} onChange={e => setShowAllVoices(e.target.checked)} /> Hiện tất cả giọng VOICEVOX</label>}<div className="tts-voice-list">{speakers.map((speaker, i) => <div className="tts-voice" key={speaker}><div className={`tts-avatar tone-${i % 4}`}>{speaker === "Người dẫn" ? "✦" : speaker.slice(0, 1)}</div><div className="tts-voice-main"><label htmlFor={`voice-${i}`}>{speaker}</label><small>{speaker === "Người dẫn" ? "Tiêu đề & bối cảnh" : "Nhân vật"}</small><select id={`voice-${i}`} disabled={exporting} value={selected[speaker] || (i === 2 ? "ja-JP-KeitaNeural" : "ja-JP-NanamiNeural")} onChange={e => setSelected({...selected, [speaker]: e.target.value})}><option value="ja-JP-NanamiNeural">Nanami · Nữ (neural)</option><option value="ja-JP-KeitaNeural">Keita · Nam (neural)</option>{voicevox.length > 0 && <optgroup label={showAllVoices ? "VOICEVOX · tất cả" : "VOICEVOX · gợi ý"}>{voicevox.filter(v => showAllVoices || recommendedVoices[v.id] || selected[speaker] === `voicevox:${v.id}`).map(v => <option value={`voicevox:${v.id}`} key={v.id}>{recommendedVoices[v.id] ? `${recommendedVoices[v.id]} · bình thường` : `${v.name} · ${v.style}`}</option>)}</optgroup>}{jpVoices.map(v => <option value={`device:${v.voiceURI}`} key={v.voiceURI}>{v.name} ({v.lang})</option>)}</select><button type="button" className="tts-voice-preview" disabled={exporting || !supported || !lines.some(line => line.speaker === speaker)} onClick={() => { const line = lines.find(item => item.speaker === speaker); if (line) play([line]); }}>▶ Nghe thử giọng này</button></div></div>)}</div><div className="tts-speed"><div><b>Tốc độ đọc</b><strong>{rate.toFixed(1)}×</strong></div><input aria-label="Tốc độ đọc" type="range" disabled={exporting} min="0.5" max="1.5" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))}/><div className="tts-range-label"><span>Chậm hơn</span><span>Nhanh hơn</span></div></div><div className="tts-notice">ⓘ {voicevox.length ? `Đã kết nối VOICEVOX: ${voicevox.length} giọng và phong cách đọc. Giọng VOICEVOX xử lý trên máy; giọng Microsoft cần internet. Khi sử dụng bản thu, hãy xem điều kiện của từng giọng tại voicevox.hiroshiba.jp.` : "VOICEVOX chưa chạy. Giọng Microsoft cần internet; giọng thiết bị chỉ để nghe thử."}</div></section></div>
      <section className="tts-panel tts-script"><div className="tts-script-head"><div><span className="tts-kicker">BƯỚC 03 · LẮNG NGHE</span><h2>Bản đọc của bạn <span>{lines.length} đoạn</span></h2><p>Phát toàn bộ hoặc nghe riêng từng đoạn để luyện tập.</p></div><div className="tts-controls">{exporting ? <button className="tts-stop" onClick={() => exportAbort.current?.abort()}>Hủy xuất</button> : <button className="tts-stop" disabled={!lines.length} onClick={exportAudio}>↓ Tải WAV (.zip)</button>}{playing && <button className="tts-stop" onClick={stop}>■ Dừng</button>}<button className="tts-primary" disabled={!supported || !lines.length || exporting} onClick={() => play(lines)}>▶ &nbsp; Phát toàn bộ</button></div></div>{message && <p className="tts-message" role="status">{message}</p>}<div className="tts-lines">{lines.map((line, i) => <div className={`tts-line ${active === line.id ? "is-active" : ""}`} key={line.id}><span className="tts-line-num">{String(i + 1).padStart(2, "0")}</span><div className="tts-line-content"><span className="tts-line-speaker">{line.kind === "title" ? "TIÊU ĐỀ" : line.kind === "scene" ? "BỐI CẢNH" : line.speaker}{line.filename ? ` · ${line.filename}` : ""}</span><p lang="ja">{line.text}</p></div><button className="tts-play" disabled={!supported || exporting} onClick={() => play([line])} aria-label={`Phát đoạn ${i + 1}`}>{active === line.id ? "♫" : "▶"}</button></div>)}</div></section><footer className="tts-footer">Được tạo cho những buổi luyện nghe mỗi ngày <span>✦</span> Shadowing JP</footer>
    </div></main>;
}
