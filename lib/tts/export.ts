// PCM WAV and uncompressed ZIP keep exports browser-only and require no server storage.
export function wavFromAudio(audio: AudioBuffer): Uint8Array {
  const channels = audio.numberOfChannels, frames = audio.length;
  const output = new Uint8Array(44 + frames * channels * 2), view = new DataView(output.buffer);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) output[offset + i] = text.charCodeAt(i); };
  write(0, "RIFF"); view.setUint32(4, output.length - 8, true); write(8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true); view.setUint32(28, audio.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, output.length - 44, true);
  const data = Array.from({ length: channels }, (_, channel) => audio.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, data[channel][frame]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
  }
  return output;
}
function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zipFiles(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map(file => ({ ...file, nameBytes: encoder.encode(file.name), crc: crc32(file.data), offset: 0 }));
  const localSize = entries.reduce((n, e) => n + 30 + e.nameBytes.length + e.data.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.nameBytes.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22), view = new DataView(output.buffer);
  let pos = 0;
  for (const e of entries) {
    e.offset = pos; view.setUint32(pos, 0x04034b50, true); view.setUint16(pos + 4, 20, true); view.setUint16(pos + 6, 0x800, true);
    view.setUint32(pos + 14, e.crc, true); view.setUint32(pos + 18, e.data.length, true); view.setUint32(pos + 22, e.data.length, true); view.setUint16(pos + 26, e.nameBytes.length, true);
    output.set(e.nameBytes, pos + 30); output.set(e.data, pos + 30 + e.nameBytes.length); pos += 30 + e.nameBytes.length + e.data.length;
  }
  for (const e of entries) {
    view.setUint32(pos, 0x02014b50, true); view.setUint16(pos + 4, 20, true); view.setUint16(pos + 6, 20, true); view.setUint16(pos + 8, 0x800, true);
    view.setUint32(pos + 16, e.crc, true); view.setUint32(pos + 20, e.data.length, true); view.setUint32(pos + 24, e.data.length, true); view.setUint16(pos + 28, e.nameBytes.length, true); view.setUint32(pos + 42, e.offset, true);
    output.set(e.nameBytes, pos + 46); pos += 46 + e.nameBytes.length;
  }
  view.setUint32(pos, 0x06054b50, true); view.setUint16(pos + 8, entries.length, true); view.setUint16(pos + 10, entries.length, true); view.setUint32(pos + 12, centralSize, true); view.setUint32(pos + 16, localSize, true);
  return output;
}
