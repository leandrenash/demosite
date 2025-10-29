import { NextRequest } from 'next/server';
import { getSystemPrompt } from '@/lib/prompt/system';

export async function POST(_req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500 });
  }

  const body = {
    model: 'gpt-4o-realtime-preview-2024-12-17',
    voice: 'verse',
    turn_detection: { type: 'server_vad' },
    instructions: getSystemPrompt()
  } as const;

  const resp = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'realtime=v1'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    return new Response(JSON.stringify({ error: 'Failed to create session', detail: text }), { status: 500 });
  }

  const json = (await resp.json()) as { client_secret?: { value?: string }; id?: string };
  return Response.json({ client_secret: json.client_secret?.value, id: json.id });
}


