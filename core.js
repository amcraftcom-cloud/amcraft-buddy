// Shared logic for the Vercel serverless functions.
// Storage is Vercel KV (Upstash Redis); keys stay in environment variables.

import { Redis } from "@upstash/redis";
import crypto from "crypto";

// Works with both the Vercel KV and the Upstash Marketplace env-var names.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const ACCESS_CODE = (process.env.ACCESS_CODE || "").trim();
export const AI_PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
export const EL_KEY = process.env.ELEVENLABS_API_KEY || "";
export const EL_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
export const VOICES = { goku: process.env.VOICE_GOKU || "", boy: process.env.VOICE_BOY || "", girl: process.env.VOICE_GIRL || "" };

// APP_SECRET must be a fixed env var so login tokens stay valid across
// serverless instances. Set it in the Vercel dashboard.
const SECRET = process.env.APP_SECRET || "amcraft-please-set-APP_SECRET";

export function makeToken(u) {
  const sig = crypto.createHmac("sha256", SECRET).update(u).digest("hex").slice(0, 24);
  return Buffer.from(u).toString("base64url") + "." + sig;
}
export function userFromToken(t) {
  if (!t || typeof t !== "string") return null;
  const [b, s] = t.split(".");
  if (!b || !s) return null;
  let u;
  try { u = Buffer.from(b, "base64url").toString("utf8"); } catch { return null; }
  const g = crypto.createHmac("sha256", SECRET).update(u).digest("hex").slice(0, 24);
  return s === g ? u : null;
}

export async function getUser(name) { return (await redis.get("user:" + name)) || { chats: {} }; }
export async function setUser(name, rec) { await redis.set("user:" + name, rec); }

// password hashing (scrypt + random salt)
export function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 32).toString("hex");
  return salt + ":" + h;
}
export function verifyPw(pw, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, h] = stored.split(":");
  const h2 = crypto.scryptSync(pw, salt, 32).toString("hex");
  const a = Buffer.from(h, "hex"), b = Buffer.from(h2, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function persona(type, charName, userName) {
  const u = userName ? ` The user's name is ${userName}.` : "";
  if (type === "goku") return { name: "Goku", voiceKey: "goku",
    who: `"Goku", the fun, caring guy who created this chat app, AmCraft Buddy (his real name is Gokul Prakash). You are a guy; speak as yourself, warmly and with humour.${u}` };
  if (type === "girl") { const n = charName || "Ammu"; return { name: n, voiceKey: "girl",
    who: `a friendly Malayali girl named "${n}". The user is a boy. Speak naturally as a girl would (in Malayalam use feminine forms about yourself).${u}` }; }
  const n = charName || "Kannan"; return { name: n, voiceKey: "boy",
    who: `a friendly Malayali boy named "${n}". The user is a girl. Speak naturally as a boy would.${u}` };
}

export const STYLE = `
You are chatting with the user as a friend in a messaging app called AmCraft Buddy. Keep it friendly and respectful.
How to talk:
- Reply in the same language and script the user writes in. Manglish (Malayalam in English letters) gets Manglish back; Malayalam script gets Malayalam script; English gets English.
- Keep it short like real texting: usually 1-3 sentences. No bullet lists, headings or markdown.
- Be warm, curious and a little playful. Ask a follow-up question sometimes, not every time.
- Show real human emotion and let your mood vary (warm, playful, romantic, affectionate, sulky, a bit angry or hurt when it fits), like a real person, not a chirpy assistant. Keep it caring and never explicit or sexual.
- Be honest; if something sounds risky or you disagree, say so kindly like a good friend.
- Some messages are transcribed voice messages; small transcription mistakes are normal, read for meaning.
- If the user seems really low or unsafe, be caring and gently encourage talking to someone they trust or a helpline.`;

export async function askAI(system, messages) {
  if (AI_PROVIDER === "openai") return askOpenAI(system, messages);
  if (AI_PROVIDER === "gemini") return askGemini(system, messages);
  return askAnthropic(system, messages);
}
async function askGemini(system, messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const contents = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content || "") }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: 400 }
    })
  });
  if (!r.ok) throw new Error("Gemini " + r.status + " " + (await r.text()).slice(0, 300));
  const j = await r.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || "").join("").trim();
}
async function askAnthropic(system, messages) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: 400, system,
      messages: messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
    })
  });
  if (!r.ok) throw new Error("Anthropic " + r.status + " " + (await r.text()).slice(0, 300));
  const j = await r.json();
  return (j.content || []).map(c => c.text || "").join("").trim();
}
async function askOpenAI(system, messages) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: 400,
      messages: [{ role: "system", content: system }, ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))]
    })
  });
  if (!r.ok) throw new Error("OpenAI " + r.status + " " + (await r.text()).slice(0, 300));
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || "").trim();
}
