interface Props {
  onClose: () => void;
  feature?: string;
}

export default function UpgradeModal({ onClose, feature }: Props) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 301, width: 420,
        background: 'var(--surface)', border: '1px solid rgba(124,92,252,0.35)',
        borderRadius: 18, padding: '36px 32px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.18s ease',
      }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>🚀</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.3px' }}>
          Plan Agence requis
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24 }}>
          {feature
            ? <><strong style={{ color: 'var(--text)' }}>{feature}</strong> est une fonctionnalité du Plan Agence.</>
            : 'Cette fonctionnalité est réservée au Plan Agence.'
          }
          {' '}Passez à 49€/mois pour débloquer jusqu'à 5 utilisateurs, la gestion des rôles, l'affectation de dossiers et les statistiques équipe.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href="mailto:tim.baron.35@gmail.com?subject=Upgrade Plan Agence Orbit"
            style={{
              display: 'block', textAlign: 'center',
              padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: 'linear-gradient(135deg, #7c5cfc, #6d4df0)', color: 'white',
              textDecoration: 'none', boxShadow: '0 0 24px rgba(124,92,252,0.3)',
            }}
          >
            Contacter pour passer au Plan Agence →
          </a>
          <button
            onClick={onClose}
            style={{
              padding: '10px', borderRadius: 10, fontSize: 13.5, fontWeight: 500,
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            Rester sur le Plan Solo
          </button>
        </div>
      </div>
    </>
  );
}
