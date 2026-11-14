import { userFromToken, getUser, setUser, persona, STYLE, askAI } from "../lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};
  const user = userFromToken(b.token);
  if (!user) return res.status(401).json({ error: "login venam" });
  const { personaType = "boy", charName = "", userName = "", messages = [], proactive = false, voice = false } = b;
  if (!Array.isArray(messages)) return res.status(400).json({ error: "bad messages" });
  const p = persona(personaType, charName, userName);
  const system = `You are ${p.who}${STYLE}`;
  const turns = messages.slice(-30).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 4000) }));
  if (proactive) turns.push({ role: "user", content: "(The user has gone quiet and hasn't replied for a while. As their buddy, send ONE short spontaneous message now — check in, say you miss them, share a small thought, or gently tease — in your current mood. Reply with only the message text.)" });
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length) return res.status(400).json({ error: "empty" });
  try {
    const reply = await askAI(system, turns);
    if (!reply) throw new Error("empty reply");
    const rec = await getUser(user);
    rec.chats[personaType] = rec.chats[personaType] || [];
    if (!proactive) {
      const last = messages[messages.length - 1];
      if (last && last.role === "user") rec.chats[personaType].push({ role: "user", content: String(last.content).slice(0, 4000), voice: !!voice, t: Date.now() });
    }
    rec.chats[personaType].push({ role: "assistant", content: reply, voice: !!voice, t: Date.now() });
    rec.chats[personaType] = rec.chats[personaType].slice(-400);
    await setUser(user, rec);
    res.json({ reply, voiceKey: p.voiceKey });
  } catch (e) {
    console.error("chat error:", e.message);
    res.status(502).json({ error: "AI-yil ninnu reply vannilla. Vercel logs nokku." });
  }
}
