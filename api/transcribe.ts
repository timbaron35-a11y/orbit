import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { toFile } from 'openai';

export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY manquante' });

  const { audio, mimeType = 'audio/webm' } = req.body as { audio: string; mimeType?: string };
  if (!audio) return res.status(400).json({ error: 'Audio manquant' });

  try {
    const openai = new OpenAI({ apiKey });
    const buffer = Buffer.from(audio, 'base64');
    const file = await toFile(buffer, 'recording.webm', { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'fr',
    });

    res.json({ transcript: transcription.text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    res.status(500).json({ error: message });
  }
}
