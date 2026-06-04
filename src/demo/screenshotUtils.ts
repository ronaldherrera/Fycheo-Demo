import { toCanvas } from 'html-to-image';

export type DeviceType = 'desktop' | 'tablet' | 'phone';

const DEVICE_DIMS = {
  desktop: { nativeW: 1440, nativeH: 900 },
  tablet:  { nativeW: 1280, nativeH: 800 },
  phone:   { nativeW: 390,  nativeH: 760 },
} as const;

function download(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = filename;
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { URL.revokeObjectURL(url); resolve(); }, 200);
    }, 'image/png');
  });
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
}

async function captureIframe(device: DeviceType): Promise<HTMLCanvasElement> {
  const iframe = document.querySelector('iframe[title="demo"]') as HTMLIFrameElement | null;
  if (!iframe) throw new Error('Demo iframe not found');

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) throw new Error('Cannot access iframe document (not same-origin?)');

  const { nativeW, nativeH } = DEVICE_DIMS[device];
  return toCanvas(doc.documentElement, {
    width: nativeW,
    height: nativeH,
    canvasWidth: nativeW,
    canvasHeight: nativeH,
    backgroundColor: null,
    pixelRatio: 1,
    skipFonts: false,
  });
}

// ── Frame builders ──────────────────────────────────────────────

function buildDesktop(app: HTMLCanvasElement): HTMLCanvasElement {
  const S = 2;
  const nW = 1440, nH = 900;
  const chromH = 48;
  const brd = 1;
  const rad = 16;
  const totalW = nW + brd * 2;
  const totalH = nH + chromH + brd * 2;

  const c = document.createElement('canvas');
  c.width  = totalW * S;
  c.height = totalH * S;
  const ctx = c.getContext('2d')!;
  ctx.scale(S, S);

  // Clip to outer rounded frame → corners transparent
  ctx.save();
  rr(ctx, 0, 0, totalW, totalH, rad);
  ctx.clip();

  // Background
  ctx.fillStyle = '#0f1520';
  ctx.fillRect(0, 0, totalW, totalH);

  // Chrome bar
  ctx.fillStyle = '#1a2235';
  ctx.fillRect(brd, brd, nW, chromH);

  // Chrome separator
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(brd, brd + chromH - 1, nW, 1);

  // Traffic lights
  const tlY = brd + chromH / 2;
  const tlX = brd + 14;
  (['#ef4444bb', '#eab308bb', '#22c55ebb'] as const).forEach((col, i) => {
    ctx.beginPath();
    ctx.arc(tlX + i * 17, tlY, 5, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  });

  // URL bar
  const urlX = tlX + 51 + 20;
  const urlW = nW - urlX - 14;
  const urlH = 24;
  const urlY = brd + (chromH - urlH) / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  rr(ctx, urlX, urlY, urlW, urlH, 5);
  ctx.fill();
  // lock icon
  ctx.beginPath();
  ctx.arc(urlX + 14, urlY + urlH / 2, 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // App content
  ctx.drawImage(app, brd, brd + chromH, nW, nH);

  ctx.restore();

  // Border
  ctx.save();
  rr(ctx, 0.5, 0.5, totalW - 1, totalH - 1, rad);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  return c;
}

function buildTablet(app: HTMLCanvasElement): HTMLCanvasElement {
  const S = 2;
  const nW = 1280, nH = 800;
  const topH = 32, botH = 48;
  const brd = 6;
  const outerRad = 24, innerRad = 18;
  const totalW = nW + brd * 2;
  const totalH = nH + topH + botH + brd * 2;

  const c = document.createElement('canvas');
  c.width  = totalW * S;
  c.height = totalH * S;
  const ctx = c.getContext('2d')!;
  ctx.scale(S, S);

  ctx.save();
  rr(ctx, 0, 0, totalW, totalH, outerRad);
  ctx.fillStyle = '#2d4060';
  ctx.fill();
  ctx.clip();

  // Inner area
  rr(ctx, brd, brd, nW, nH + topH + botH, innerRad);
  ctx.fillStyle = '#0B0E14';
  ctx.fill();

  // Top bar
  ctx.fillStyle = '#233050';
  ctx.fillRect(brd, brd, nW, topH);
  // pill left
  rr(ctx, brd + 16, brd + topH / 2 - 3, 32, 6, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();
  // dots right
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.arc(brd + nW - 18 - i * 13, brd + topH / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
  }

  // App content
  ctx.drawImage(app, brd, brd + topH, nW, nH);

  // Bottom bar
  ctx.fillStyle = '#233050';
  ctx.fillRect(brd, brd + topH + nH, nW, botH);
  // Home button
  ctx.beginPath();
  ctx.arc(brd + nW / 2, brd + topH + nH + botH / 2, 14, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  // Ring
  ctx.save();
  rr(ctx, 0.5, 0.5, totalW - 1, totalH - 1, outerRad);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  return c;
}

function buildPhone(app: HTMLCanvasElement): HTMLCanvasElement {
  const S = 2;
  const nW = 390, nH = 760;
  const notchH = 40, homeH = 28;
  const brd = 8;
  const outerRad = 44, innerRad = 36;
  const totalW = nW + brd * 2;
  const totalH = nH + notchH + homeH + brd * 2;

  const c = document.createElement('canvas');
  c.width  = totalW * S;
  c.height = totalH * S;
  const ctx = c.getContext('2d')!;
  ctx.scale(S, S);

  ctx.save();
  rr(ctx, 0, 0, totalW, totalH, outerRad);
  ctx.fillStyle = '#2a3a55';
  ctx.fill();
  ctx.clip();

  // Inner area
  rr(ctx, brd, brd, nW, nH + notchH + homeH, innerRad);
  ctx.fillStyle = '#080C14';
  ctx.fill();

  // Notch area
  ctx.fillStyle = '#0d1322';
  ctx.fillRect(brd, brd, nW, notchH);
  // dynamic island
  rr(ctx, brd + nW / 2 - 48, brd + (notchH - 24) / 2, 96, 24, 12);
  ctx.fillStyle = '#1e2d47';
  ctx.fill();
  // camera dot
  ctx.beginPath();
  ctx.arc(brd + nW / 2 - 16, brd + notchH / 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();
  // speaker pill
  rr(ctx, brd + nW / 2, brd + (notchH - 6) / 2, 32, 6, 3);
  ctx.fillStyle = '#111827';
  ctx.fill();

  // App content
  ctx.drawImage(app, brd, brd + notchH, nW, nH);

  // Home area
  ctx.fillStyle = '#0d1322';
  ctx.fillRect(brd, brd + notchH + nH, nW, homeH);
  // home indicator
  rr(ctx, brd + nW / 2 - 48, brd + notchH + nH + homeH / 2 - 2, 96, 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();

  ctx.restore();

  // Ring
  ctx.save();
  rr(ctx, 0.5, 0.5, totalW - 1, totalH - 1, outerRad);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  return c;
}

// ── Public API ──────────────────────────────────────────────────

export async function captureWithoutMockup(device: DeviceType): Promise<void> {
  const app = await captureIframe(device);
  await download(app, `fycheo-${device}.png`);
}

export async function captureWithMockup(device: DeviceType): Promise<void> {
  const app = await captureIframe(device);
  const mockup =
    device === 'desktop' ? buildDesktop(app) :
    device === 'tablet'  ? buildTablet(app)  :
                           buildPhone(app);
  await download(mockup, `fycheo-${device}-mockup.png`);
}
