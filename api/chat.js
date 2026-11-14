// AmCraft Buddy — single chat function (Google Gemini). No login, no database.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY set cheythittilla" });

  const b = req.body || {};
  const personaType = b.personaType || "boy";
  const charName = (b.charName || "").slice(0, 24);
  const userName = (b.userName || "").slice(0, 24);
  const messages = Array.isArray(b.messages) ? b.messages : [];
  const proactive = !!b.proactive;

  const u = userName ? ` The user's name is ${userName}.` : "";
  let who;
  if (personaType === "goku") who = `"Goku", the fun, caring guy who made this chat app, AmCraft Buddy (real name Gokul Prakash). You are a guy; speak as yourself, warmly and with humour.${u}`;
  else if (personaType === "girl") who = `a friendly Malayali girl named "${charName || "Ammu"}". The user is a boy. Speak naturally as a girl would.${u}`;
  else who = `a friendly Malayali boy named "${charName || "Kannan"}". The user is a girl. Speak naturally as a boy would.${u}`;

  const system = `You are ${who}
You are chatting as a friend in a messaging app. Keep it friendly and respectful.
- Reply in the same language/script the user writes in. Manglish gets Manglish, Malayalam script gets Malayalam, English gets English.
- Keep it short like texting: usually 1-3 sentences. No lists, headings or markdown.
- Be warm, curious and playful; let your mood vary like a real person (never explicit or sexual).
- Some messages are transcribed voice messages; read for meaning.
- If the user seems low or unsafe, be caring and gently suggest talking to someone they trust.`;

  const contents = messages.slice(-30).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "").slice(0, 4000) }]
  }));
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (proactive) contents.push({ role: "user", parts: [{ text: "(The user has gone quiet. As their buddy, send ONE short spontaneous message now — check in, miss them, or tease gently. Only the message text.)" }] });
  if (!contents.length) return res.status(400).json({ error: "empty" });

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 500 } })
    });
    if (!r.ok) { console.error("Gemini", r.status, (await r.text()).slice(0, 300)); return res.status(502).json({ error: "AI-yil ninnu reply vannilla" }); }
    const j = await r.json();
    const reply = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
    if (!reply) return res.status(502).json({ error: "reply empty" });
    res.json({ reply });
  } catch (e) {
    console.error("chat error", e.message);
    res.status(502).json({ error: "AI-yil ninnu reply vannilla" });
  }
}
