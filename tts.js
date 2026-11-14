import { userFromToken, EL_KEY, EL_MODEL, VOICES } from "../lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const user = userFromToken(req.body?.token);
  if (!user) return res.status(401).json({ error: "login venam" });
  if (!EL_KEY) return res.status(400).json({ error: "voice off" });
  const text = String(req.body?.text || "").slice(0, 1200);
  const voiceKey = String(req.body?.voiceKey || "boy");
  const voiceId = VOICES[voiceKey] || VOICES.boy || VOICES.goku;
  if (!text || !voiceId) return res.status(400).json({ error: "no voice for this character" });
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": EL_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: EL_MODEL })
    });
    if (!r.ok) { console.error("TTS", r.status, (await r.text()).slice(0, 200)); return res.status(502).json({ error: "voice failed" }); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("content-type", "audio/mpeg");
    res.status(200).send(buf);
  } catch (e) {
    console.error("tts error", e.message);
    res.status(502).json({ error: "voice failed" });
  }
}
