import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY manquante' });

  const { subject, fromName, fromEmail, body } = req.body as {
    subject: string;
    fromName: string;
    fromEmail: string;
    body: string;
  };

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant CRM. Analyse cet email et extrais les informations du prospect en JSON. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.`,
        },
        {
          role: 'user',
          content: `Email reçu :
Sujet: ${subject}
De: ${fromName} <${fromEmail}>
Contenu: ${body.slice(0, 2000)}

Extrais ces champs (laisse vide si non trouvé) :
{
  "name": "prénom et nom de l'expéditeur",
  "email": "email de l'expéditeur",
  "company": "nom de l'entreprise ou société",
  "need": "besoin ou projet décrit en 1-2 phrases",
  "budget": "budget mentionné si présent",
  "stage": "Prospect"
}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    });

    const text = completion.choices[0].message.content ?? '{}';
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    return res.status(200).json(json);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return res.status(500).json({ error: message });
  }
}
