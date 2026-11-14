import { userFromToken, getUser } from "../lib/core.js";

export default async function handler(req, res) {
  const user = userFromToken(req.query?.token);
  if (!user) return res.status(401).json({ error: "login venam" });
  const persona = String(req.query?.persona || "boy");
  const rec = await getUser(user);
  res.json({ msgs: (rec.chats[persona] || []).slice(-200) });
}
