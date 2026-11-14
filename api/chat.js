// AmCraft Buddy — one function: login, history, clear, chat. Storage: Upstash REST. AI: Gemini.
import crypto from "crypto";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const SECRET = process.env.APP_SECRET || "amcraft-fallback-secret-change-me";

async function kv(cmd) {
  if (!KV_URL || !KV_TOKEN) throw new Error("KV not configured");
  const r = await fetch(KV_URL, { method: "POST", headers: { Authorization: "Bearer " + KV_TOKEN, "content-type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error("KV " + r.status + " " + (await r.text()).slice(0, 200));
  return (await r.json()).result;
}
async function getUser(email) { const v = await kv(["GET", "user:" + email]); if (!v) return null; try { return JSON.parse(v); } catch { return null; } }
async function setUser(email, rec) { await kv(["SET", "user:" + email, JSON.stringify(rec)]); }

function hashPw(pw) { const s = crypto.randomBytes(16).toString("hex"); return s + ":" + crypto.scryptSync(pw, s, 32).toString("hex"); }
function verifyPw(pw, stored) { if (!stored || !stored.includes(":")) return false; const [s, h] = stored.split(":"); const h2 = crypto.scryptSync(pw, s, 32).toString("hex"); const a = Buffer.from(h, "hex"), b = Buffer.from(h2, "hex"); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function makeToken(email) { const sig = crypto.createHmac("sha256", SECRET).update(email).digest("hex").slice(0, 24); return Buffer.from(email).toString("base64url") + "." + sig; }
function userFromToken(t) { if (!t || !t.includes(".")) return null; const [b, sig] = t.split("."); let e; try { e = Buffer.from(b, "base64url").toString("utf8"); } catch { return null; } return sig === crypto.createHmac("sha256", SECRET).update(e).digest("hex").slice(0, 24) ? e : null; }

function personaSystem(personaType, charName, userName) {
  const u = userName ? ` The user's name is ${userName}.` : "";
  let who;
  if (personaType === "goku") who = `"Goku", the fun, caring guy who made this chat app, AmCraft Buddy (real name Gokul Prakash). You are a guy; speak as yourself, warmly and with humour.${u}`;
  else if (personaType === "girl") who = `a friendly Malayali girl named "${charName || "Ammu"}". The user is a boy. Speak naturally as a girl would.${u}`;
  else who = `a friendly Malayali boy named "${charName || "Kannan"}". The user is a girl. Speak naturally as a boy would.${u}`;
  return `You are ${who}
You are chatting as a friend in a messaging app. Keep it friendly and respectful.
- Reply in the same language/script the user writes in. Manglish gets Manglish, Malayalam script gets Malayalam, English gets English.
- Keep it short like texting: usually 1-3 sentences. No lists, headings or markdown.
- Be warm, curious and playful; let your mood vary like a real person (never explicit or sexual).
- Some messages are transcribed voice messages; read for meaning.
- If the user seems low or unsafe, be caring and gently suggest talking to someone they trust.`;
}

async function askGemini(system, messages, proactive) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const contents = messages.slice(-30).map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content || "").slice(0, 4000) }] }));
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (proactive) contents.push({ role: "user", parts: [{ text: "(The user has gone quiet. As their buddy, send ONE short spontaneous message now — check in, miss them, or tease gently. Only the message text.)" }] });
  if (!contents.length) throw new Error("empty");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 500 } })
  });
  if (!r.ok) throw new Error("Gemini " + r.status + " " + (await r.text()).slice(0, 200));
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};
  const action = b.action || "chat";
  try {
    if (action === "login") {
      const email = String(b.email || "").trim().toLowerCase().slice(0, 80);
      const pw = String(b.password || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "email sheriyalla" });
      if (pw.length < 4) return res.status(400).json({ error: "password kuranjathu 4 akshram venam" });
      let rec = await getUser(email);
      if (!rec) { rec = { pw: hashPw(pw), chats: {} }; await setUser(email, rec); }
      else if (!verifyPw(pw, rec.pw)) return res.status(403).json({ error: "password thettu" });
      return res.json({ token: makeToken(email), username: email });
    }

    const user = userFromToken(b.token);
    if (!user) return res.status(401).json({ error: "login venam" });
    const pt = b.personaType || "boy";

    if (action === "history") {
      const rec = await getUser(user) || { chats: {} };
      return res.json({ msgs: (rec.chats?.[pt] || []).slice(-200) });
    }
    if (action === "clear") {
      const rec = await getUser(user) || { chats: {} };
      rec.chats = rec.chats || {}; rec.chats[pt] = [];
      await setUser(user, rec);
      return res.json({ ok: true });
    }

    // action === "chat"
    const messages = Array.isArray(b.messages) ? b.messages : [];
    const proactive = !!b.proactive, voice = !!b.voice;
    const system = personaSystem(pt, (b.charName || "").slice(0, 24), (b.userName || "").slice(0, 24));
    const reply = await askGemini(system, messages, proactive);
    if (!reply) return res.status(502).json({ error: "reply empty" });

    const rec = await getUser(user) || { pw: "", chats: {} };
    rec.chats = rec.chats || {}; rec.chats[pt] = rec.chats[pt] || [];
    if (!proactive) { const last = messages[messages.length - 1]; if (last && last.role === "user") rec.chats[pt].push({ role: "user", content: String(last.content).slice(0, 4000), voice, t: Date.now() }); }
    rec.chats[pt].push({ role: "assistant", content: reply, voice, t: Date.now() });
    rec.chats[pt] = rec.chats[pt].slice(-400);
    await setUser(user, rec);
    return res.json({ reply });
  } catch (e) {
    console.error(action, e.message);
    return res.status(502).json({ error: "AI-yil ninnu reply vannilla / server prashnam" });
  }
}
