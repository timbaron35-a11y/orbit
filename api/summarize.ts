import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY manquante' });

  const { transcript, prospectName } = req.body as { transcript: string; prospectName: string };
  if (!transcript) return res.status(400).json({ error: 'Transcription manquante' });

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant CRM pour freelances. Tu analyses des transcriptions d'appels professionnels et tu produis des résumés concis et exploitables. Réponds toujours en français.`,
        },
        {
          role: 'user',
          content: `Voici la transcription d'un appel avec ${prospectName || 'un prospect'}.

Produis un résumé structuré avec :
1. **Résumé** (2-3 phrases max)
2. **Points clés** (3-5 bullet points)
3. **Actions à suivre** (si mentionnées, sinon omets cette section)

Transcription :
${transcript}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    res.json({ summary: completion.choices[0].message.content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    res.status(500).json({ error: message });
  }
}
