import { userFromToken, getUser, setUser } from "../lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const user = userFromToken(req.body?.token);
  if (!user) return res.status(401).json({ error: "login venam" });
  const persona = String(req.body?.personaType || "boy");
  const rec = await getUser(user);
  rec.chats[persona] = [];
  await setUser(user, rec);
  res.json({ ok: true });
}
