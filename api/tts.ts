import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY manquante' });

  const { text } = req.body as { text: string };
  if (!text) return res.status(400).json({ error: 'Texte manquant' });

  const openai = new OpenAI({ apiKey });

  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text.slice(0, 500),
    speed: 1.05,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}
