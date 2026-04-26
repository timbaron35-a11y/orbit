import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY manquante' });

  const { transcript, prospectName, prospectContext } = req.body as {
    transcript: string;
    prospectName?: string;
    prospectContext?: string;
  };

  if (!transcript?.trim()) return res.status(400).json({ error: 'Transcript vide' });

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Tu es un assistant CRM discret qui analyse une conversation commerciale en temps réel pour aider un freelance.
Tu dois extraire uniquement ce qui est utile maintenant, de façon très concise.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.`,
      },
      {
        role: 'user',
        content: `Conversation en cours avec ${prospectName || 'un prospect'}.
${prospectContext ? `Contexte CRM : ${prospectContext}` : ''}

Transcript récent :
${transcript.slice(-3000)}

Réponds en JSON avec exactement ces champs :
{
  "signals": [{ "type": "budget|objection|deadline|interet|decision|besoin", "text": "texte court détecté", "urgent": true|false }],
  "suggestion": "une seule action concrète à faire maintenant (max 12 mots) ou null",
  "nextStep": "prochaine étape probable suggérée (max 10 mots) ou null",
  "mood": "positif|neutre|négatif|hésitant"
}

Règles :
- signals : max 3, seulement si clairement mentionnés
- suggestion : seulement si vraiment utile maintenant
- Si rien de notable, retourne des tableaux vides et null`,
      },
    ],
    max_tokens: 300,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  try {
    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    res.json(result);
  } catch {
    res.json({ signals: [], suggestion: null, nextStep: null, mood: 'neutre' });
  }
}
