import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY manquante' });

  const { transcript, prospectName, durationSeconds } = req.body as { transcript: string; prospectName: string; durationSeconds?: number };
  if (!transcript) return res.status(400).json({ error: 'Transcription manquante' });

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant CRM ultra-concis pour freelances. Tu extrais UNIQUEMENT les informations commerciales critiques d'un appel. Sois brutal dans ta sélection : ignore les politesses, digressions et tout ce qui n'est pas directement actionnable. Réponds en français.`,
        },
        {
          role: 'user',
          content: `Transcription d'un appel de ${durationSeconds ? Math.round(durationSeconds / 60) + ' min' : 'durée inconnue'} avec ${prospectName || 'un prospect'}.

RÈGLES STRICTES :
- Maximum 8 bullet points, minimum 3
- Chaque point commence par une catégorie : Budget / Décision / Objection / Prochaine étape / Délai / Besoin
- Format : "Budget : 4 500 € confirmé"
- Si une info n'est pas mentionnée clairement, ne l'invente pas et n'en parle pas
- Ignore tout ce qui est hors-sujet commercial

Transcription :
${transcript.slice(0, 12000)}`,
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
