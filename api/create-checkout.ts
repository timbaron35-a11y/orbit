import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const APP_URL = 'https://app-orbit.fr';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const PRICE_IDS: Record<string, string> = {
      solo: process.env.STRIPE_PRICE_SOLO!,
      agence: process.env.STRIPE_PRICE_AGENCE!,
    };

    const { uid, email, plan } = req.body as { uid: string; email: string; plan: 'solo' | 'agence' };
    if (!uid || !email || !plan) return res.status(400).json({ error: 'Paramètres manquants' });

    const priceId = PRICE_IDS[plan];
    if (!priceId) return res.status(400).json({ error: 'Plan inconnu' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { uid, plan },
      },
      metadata: { uid, plan },
      success_url: `${APP_URL}/settings?payment=success&plan=${plan}`,
      cancel_url: `${APP_URL}/settings?payment=cancelled`,
      locale: 'fr',
    });
    return res.status(200).json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
