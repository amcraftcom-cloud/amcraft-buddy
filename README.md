# AmCraft Buddy — Vercel version

Same chat app (text + voice, boy / girl / **Goku**), built to run on **Vercel**:
the frontend is static, the backend is serverless functions in `/api`, and chat
is stored in **Vercel KV** (so the same login continues on phone and laptop).

## Files
```
index.html        the app (served at /)
goku.jpg          Goku's photo
api/              serverless functions (config, login, history, chat, clear, tts)
lib/core.js       shared logic (tokens, personas, AI calls, KV storage)
package.json
.env.example
```

## Deploy — step by step

1. **Put this folder in a GitHub repo** (or install the Vercel CLI and run
   `vercel` from inside the folder).

2. **Import the repo at vercel.com** → "Add New → Project". No build settings
   needed; Vercel auto-detects the `/api` functions and the static files.

3. **Create the storage (Upstash Redis):**
   - In the project, open the **Storage** tab → **Create Database**.
   - Under **Marketplace Database Providers**, pick **Upstash** → **Redis**
     (a.k.a. Serverless Redis) → create it → **Connect** it to this project.
   - This automatically adds the connection env vars (`KV_REST_API_URL` /
     `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
     The code reads either naming, so you don't type those yourself.
   - After connecting, **Redeploy** (step 5) so the functions pick it up.

4. **Add the rest of the environment variables** (Settings → Environment
   Variables):
   ```
   APP_SECRET            a long random string you make up (required)
   AI_PROVIDER           anthropic   (or openai)
   ANTHROPIC_API_KEY     sk-ant-...  (if anthropic)
   ANTHROPIC_MODEL       claude-3-5-sonnet-latest
   OPENAI_API_KEY        sk-...      (if openai)
   OPENAI_MODEL          gpt-4o-mini
   ELEVENLABS_API_KEY    (blank = text only)
   ELEVENLABS_MODEL      eleven_multilingual_v2
   VOICE_GOKU            your cloned voice's voice_id
   VOICE_BOY             a male voice_id
   VOICE_GIRL            a female voice_id
   ACCESS_CODE           (optional password to enter the app)
   ```

5. **Deploy.** Vercel gives you an `https://your-app.vercel.app` link (HTTPS, so
   the microphone / voice messages work). Share that link — anyone can use it,
   no Claude account needed.

> After changing environment variables, **redeploy** for them to take effect.

## Notes
- **APP_SECRET must stay the same** — if you change it, everyone's login tokens
  stop working (they just log in again with the same name).
- **Chat is private per login name.** No admin can read others' chats.
- **Costs:** each reply uses your AI key's credits; each voice line uses your
  ElevenLabs credits. That is unavoidable for a public app.
- **Model errors:** if the AI call fails with "model not found", set
  `ANTHROPIC_MODEL` / `OPENAI_MODEL` to a model your key actually has.
- **If `@vercel/kv` is unavailable** in your Vercel account, create an **Upstash
  Redis** store from the Marketplace instead — it injects the same
  `KV_REST_API_URL` / `KV_REST_API_TOKEN`, and the code works unchanged.

## Test locally (optional)
```bash
npm i -g vercel
vercel link        # link to your project
vercel env pull .env   # pulls KV + your env vars
vercel dev         # runs on http://localhost:3000
```

Built by Gokul Prakash.
