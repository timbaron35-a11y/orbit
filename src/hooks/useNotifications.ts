import { useEffect, useRef } from 'react';
import type { Prospect } from '../types';

function drawIcon(accentColor: string, ctx: CanvasRenderingContext2D, size: number) {
  const r = 14;
  const cx = size / 2;
  const cy = size / 2;

  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = accentColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 13.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy - 21, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();
}

function makeIconBlobUrl(accentColor = '#7c5cfc'): Promise<string> {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve('');
    drawIcon(accentColor, ctx, 64);
    canvas.toBlob(blob => {
      resolve(blob ? URL.createObjectURL(blob) : '');
    }, 'image/png');
  });
}

export function useNotifications(overdueProspects: Prospect[]) {
  const notifiedIds = useRef<Set<string>>(new Set());
  const iconRef = useRef<string>('');

  useEffect(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c5cfc';
    makeIconBlobUrl(accent).then(url => { iconRef.current = url; });
  }, []);

  useEffect(() => {
    if (Notification.permission !== 'granted') return;
    for (const p of overdueProspects) {
      if (notifiedIds.current.has(p.id)) continue;
      notifiedIds.current.add(p.id);
      new Notification('Rappel Orbit', {
        body: `${p.name} — relance prévue aujourd'hui`,
        icon: iconRef.current || undefined,
        tag: `reminder-${p.id}`,
      });
    }
  }, [overdueProspects]);
}
