# Clinical Realtime Simulation (WebRTC)

- Next.js App Router (TypeScript) + Tailwind CSS
- WebRTC to OpenAI Realtime via ephemeral session minted server-side
- Orb UI with mic control, audio-level pulse, and synthesized SFX (with ducking)
- Strict clinical-only system prompt and short simulation flow

## Setup

1. Create `.env.local` in `web/` with:
```
OPENAI_API_KEY=sk-...
```

2. Install & run (inside `web/`):
```
npm i
npm run dev
```
Then open `http://localhost:3000` and click Start.

## Notes
- Scope locked to clinical interview; off-topic requests are redirected.
- Four curated scenarios: Chest pain (ACS), Pediatric fever, DKA, Stroke.
- Short run (≤4 exchanges). Ends with: "Hope you enjoyed this experience — powered by Sophorik."
- SFX uses Web Audio synthesis; toggle available in UI.
