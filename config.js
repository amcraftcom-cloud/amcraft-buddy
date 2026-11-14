import { ACCESS_CODE, EL_KEY, VOICES } from "../lib/core.js";

export default function handler(req, res) {
  res.json({ needCode: !!ACCESS_CODE, voice: !!EL_KEY, voices: { goku: !!VOICES.goku, boy: !!VOICES.boy, girl: !!VOICES.girl } });
}
