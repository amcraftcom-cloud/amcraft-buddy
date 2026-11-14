import { ACCESS_CODE, makeToken, getUser, setUser, hashPw, verifyPw } from "../lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 80);
  const password = String(req.body?.password || "");
  const code = String(req.body?.code || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "email sheriyalla" });
  if (password.length < 4) return res.status(400).json({ error: "password kuranjathu 4 akshram venam" });
  if (ACCESS_CODE && code !== ACCESS_CODE) return res.status(403).json({ error: "access code thettu" });

  const rec = await getUser(email);
  if (!rec.pw) {
    // first time with this email -> create the account with this password
    rec.pw = hashPw(password);
    rec.chats = rec.chats || {};
    await setUser(email, rec);
  } else {
    // existing account -> the password must match
    if (!verifyPw(password, rec.pw)) return res.status(403).json({ error: "password thettu" });
  }
  res.json({ token: makeToken(email), username: email });
}
