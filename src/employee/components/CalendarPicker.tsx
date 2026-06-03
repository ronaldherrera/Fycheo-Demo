import { useState, useMemo } from 'react';

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];
const DAYS = ['L','M','X','J','V','S','D'];

interface Props {
  value: string;       // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string;    // YYYY-MM-DD — días anteriores quedan desactivados
}

export default function CalendarPicker({ value, onChange, minDate }: Props) {
  const selected = value ? new Date(value + 'T00:00:00') : new Date();
  const [current, setCurrent] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));

  const calDays = useMemo(() => {
    const year  = current.getFullYear();
    const month = current.getMonth();
    const first = new Date(year, month, 1).getDay();
    const start = first === 0 ? 6 : first - 1;
    const total = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < start; i++) days.push(null);
    for (let i = 1; i <= total; i++) days.push(i);
    return days;
  }, [current]);

  const toISO = (day: number) =>
    `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  const isSelected = (day: number) => toISO(day) === value;

  const isToday = (day: number) => {
    const t = new Date();
    return t.getDate() === day && t.getMonth() === current.getMonth() && t.getFullYear() === current.getFullYear();
  };

  const isDisabled = (day: number) => !!minDate && toISO(day) < minDate;

  return (
    <div className="bg-white dark:bg-surface-dark rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
      {/* Cabecera mes/año */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors border-none bg-transparent cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {MONTHS[current.getMonth()]}
          </p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {current.getFullYear()}
          </p>
        </div>
        <button
          onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors border-none bg-transparent cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>

      {/* Banda días semana */}
      <div className="grid grid-cols-7 gap-1 mb-2 bg-slate-50 dark:bg-white/5 rounded-xl py-1">
        {DAYS.map(d => (
          <div key={d} className="h-7 flex items-center justify-center">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{d}</span>
          </div>
        ))}
      </div>

      {/* Días */}
      <div className="grid grid-cols-7 gap-1">
        {calDays.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const sel = isSelected(day);
          const tod = isToday(day);
          const dis = isDisabled(day);
          return (
            <button
              key={idx}
              disabled={dis}
              onClick={() => onChange(toISO(day))}
              className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all border-none cursor-pointer
                ${sel ? 'bg-primary text-white shadow-md shadow-primary/30 scale-105' : ''}
                ${!sel && tod ? 'ring-2 ring-primary ring-inset text-primary' : ''}
                ${!sel && !tod && !dis ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5' : ''}
                ${dis ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
