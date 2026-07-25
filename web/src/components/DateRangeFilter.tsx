interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-slate-500">De</label>
      <input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className="rounded-xl border border-gray-300 px-2 py-1.5"
      />
      <label className="text-slate-500">Até</label>
      <input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className="rounded-xl border border-gray-300 px-2 py-1.5"
      />
    </div>
  );
}
