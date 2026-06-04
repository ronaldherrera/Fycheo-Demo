import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Loader2, Check, Frame, Image } from 'lucide-react';
import { captureWithMockup, captureWithoutMockup, DeviceType } from './screenshotUtils';

const SCREENSHOT_EMAIL = 'ronaldcalzadilla31@gmail.com';

interface Props {
  device: DeviceType;
}

export default function ScreenshotTool({ device }: Props) {
  const email = localStorage.getItem('fycheo_demo_access');
  const [open, setOpen]     = useState(false);
  const [status, setStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const capture = useCallback(async (withMockup: boolean) => {
    setOpen(false);
    setStatus('capturing');
    try {
      if (withMockup) {
        await captureWithMockup(device);
      } else {
        await captureWithoutMockup(device);
      }
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('Screenshot error:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  }, [device]);

  if (email !== SCREENSHOT_EMAIL) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => status === 'idle' && setOpen(v => !v)}
        title="Capturar pantalla"
        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
          status === 'done'
            ? 'bg-emerald-500/15 border-emerald-500/30'
            : status === 'error'
            ? 'bg-red-500/15 border-red-500/30'
            : status === 'capturing'
            ? 'bg-white/8 border-white/15'
            : 'bg-white/5 border-white/8 hover:bg-white/10'
        }`}
      >
        {status === 'capturing' ? (
          <Loader2 size={12} className="text-slate-400 animate-spin" />
        ) : status === 'done' ? (
          <Check size={12} className="text-emerald-400" />
        ) : (
          <Camera size={12} className={status === 'error' ? 'text-red-400' : 'text-slate-400'} />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 w-56 overflow-hidden
                     bg-[#0c1525] border border-white/10 rounded-xl
                     shadow-2xl shadow-black/60
                     animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-3 py-2 border-b border-white/6">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Capturar pantalla
            </p>
          </div>

          <div className="p-1.5 space-y-0.5">
            <button
              onClick={() => capture(true)}
              className="w-full flex items-start gap-3 px-2.5 py-2.5 rounded-lg
                         hover:bg-white/6 text-left transition-colors group"
            >
              <Frame size={15} className="text-slate-400 shrink-0 mt-0.5 group-hover:text-white transition-colors" />
              <div>
                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                  Con mockup
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Frame del dispositivo + app,<br />fondo transparente
                </p>
              </div>
            </button>

            <button
              onClick={() => capture(false)}
              className="w-full flex items-start gap-3 px-2.5 py-2.5 rounded-lg
                         hover:bg-white/6 text-left transition-colors group"
            >
              <Image size={15} className="text-slate-400 shrink-0 mt-0.5 group-hover:text-white transition-colors" />
              <div>
                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                  Sin mockup
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Solo la app,<br />resolución nativa
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
