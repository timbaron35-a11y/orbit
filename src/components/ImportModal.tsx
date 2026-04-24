import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { ProspectStatus } from '../types';
import { STATUS_LABEL } from '../types';

interface Props {
  onClose: () => void;
}

const LABEL_TO_STATUS: Record<string, ProspectStatus> = {
  'Nouveau': 'nouveau', 'nouveau': 'nouveau',
  'Contacté': 'contacté', 'contacté': 'contacté', 'Contacte': 'contacté',
  'Devis': 'devis', 'devis': 'devis',
  'Signé': 'signé', 'signé': 'signé', 'Signe': 'signé',
  'Perdu': 'perdu', 'perdu': 'perdu',
};

interface ParsedRow {
  name: string;
  status: ProspectStatus;
  amount: number;
  lastContact: Date;
  notes: string;
}

function parseDate(str: string): Date {
  if (!str) return new Date();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(str);
  const frMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frMatch) return new Date(`${frMatch[3]}-${frMatch[2].padStart(2,'0')}-${frMatch[1].padStart(2,'0')}`);
  return new Date();
}

function parseCSV(text: string): ParsedRow[] {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  const idx = {
    name: headers.findIndex(h => h.includes('nom')),
    status: headers.findIndex(h => h.includes('statut')),
    amount: headers.findIndex(h => h.includes('montant')),
    date: headers.findIndex(h => h.includes('contact') || h.includes('date')),
    notes: headers.findIndex(h => h.includes('note')),
  };

  return lines.slice(1).map(line => {
    const cells = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
    const rawStatus = cells[idx.status] ?? '';
    return {
      name: cells[idx.name] ?? '',
      status: LABEL_TO_STATUS[rawStatus] ?? 'nouveau',
      amount: parseFloat((cells[idx.amount] ?? '0').replace(/[^\d.]/g, '')) || 0,
      lastContact: parseDate(cells[idx.date] ?? ''),
      notes: cells[idx.notes] ?? '',
    };
  }).filter(r => r.name.trim());
}

export default function ImportModal({ onClose }: Props) {
  const { user } = useAuth();
  const { workspaceUid } = useWorkspace();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setError('Aucune ligne valide trouvée. Vérifiez le format du fichier.');
      } else {
        setRows(parsed);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!user || rows.length === 0) return;
    setImporting(true);
    const ref = collection(db, 'users', workspaceUid, 'prospects');
    await Promise.all(rows.map(r => addDoc(ref, {
      name: r.name,
      status: r.status,
      amount: r.amount,
      lastContact: Timestamp.fromDate(r.lastContact),
      notes: r.notes,
      tags: [],
    })));
    setDone(true);
    setImporting(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, backdropFilter: 'blur(3px)', animation: 'fadeIn 0.15s ease' }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 560,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        zIndex: 201, animation: 'fadeIn 0.15s ease',
        display: 'flex', flexDirection: 'column', maxHeight: '80vh',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.2px' }}>Importer des prospects</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
              Format attendu : colonnes Nom, Statut, Montant, Dernier contact, Notes
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 18 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                {rows.length} prospect{rows.length > 1 ? 's' : ''} importé{rows.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Les données sont maintenant visibles dans Clients et Pipeline.</div>
            </div>
          ) : (
            <>
              {/* File drop zone */}
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: `2px dashed ${rows.length > 0 ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, padding: '28px 20px', cursor: 'pointer',
                background: rows.length > 0 ? 'var(--accent-dim)' : 'transparent',
                transition: 'all 0.15s', marginBottom: 16, gap: 8,
              }}>
                <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
                <span style={{ fontSize: 22 }}>📂</span>
                <span style={{ fontSize: 13.5, color: rows.length > 0 ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 500 }}>
                  {fileName || 'Cliquer pour choisir un fichier CSV'}
                </span>
                {rows.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>{rows.length} ligne{rows.length > 1 ? 's' : ''} détectée{rows.length > 1 ? 's' : ''}</span>
                )}
              </label>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* Preview */}
              {rows.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Aperçu ({Math.min(rows.length, 4)} sur {rows.length})
                  </div>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {rows.slice(0, 4).map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < Math.min(rows.length, 4) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>{r.name}</span>
                        <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 20, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {STATUS_LABEL[r.status]}
                        </span>
                        {r.amount > 0 && (
                          <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}>{r.amount}€</span>
                        )}
                      </div>
                    ))}
                    {rows.length > 4 && (
                      <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                        + {rows.length - 4} autre{rows.length - 4 > 1 ? 's' : ''}…
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 500 }}>
            {done ? 'Fermer' : 'Annuler'}
          </button>
          {!done && (
            <button
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500,
                background: rows.length > 0 ? 'var(--accent)' : 'var(--surface-2)',
                color: rows.length > 0 ? 'white' : 'var(--text-muted)',
                opacity: importing ? 0.7 : 1,
              }}
            >
              {importing ? 'Import en cours…' : `Importer ${rows.length > 0 ? rows.length + ' prospect' + (rows.length > 1 ? 's' : '') : ''}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
