import React from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export const VerdictBadge = ({ verdict, className = "" }: { verdict: string, className?: string }) => {
  let colorClass = "";
  let Icon = AlertTriangle;

  if (verdict === 'GO') {
    colorClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 print:bg-transparent print:text-black print:border-black";
    Icon = CheckCircle;
  } else if (verdict === 'GO CONDITIONAL') {
    colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/50 print:bg-transparent print:text-black print:border-black";
    Icon = AlertTriangle;
  } else {
    colorClass = "bg-rose-500/10 text-rose-400 border-rose-500/50 print:bg-transparent print:text-black print:border-black";
    Icon = XCircle;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 md:px-4 rounded-full border ${colorClass} ${className} font-bold tracking-wider text-[10px] md:text-xs uppercase whitespace-nowrap`}>
      <Icon className="w-3 h-3 md:w-4 md:h-4" />
      {verdict}
    </div>
  );
};

export const ScoreGauge = ({ score }: { score: number }) => {
  let color = "text-rose-500 print:text-black";
  let borderColor = "border-rose-500/20 print:border-black";
  
  if (score > 70) {
      color = "text-emerald-500 print:text-black";
      borderColor = "border-emerald-500/20 print:border-black";
  } else if (score > 40) {
      color = "text-amber-500 print:text-black";
      borderColor = "border-amber-500/20 print:border-black";
  }

  return (
    <div className={`relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full border-[4px] md:border-[6px] ${borderColor} bg-slate-900/50 print:bg-transparent print:border-4`}>
      <div className={`absolute text-3xl md:text-4xl font-black ${color} tracking-tighter`}>
        {score.toFixed(0)}
      </div>
      <div className="absolute bottom-5 md:bottom-7 text-[8px] text-slate-400 print:text-black uppercase tracking-widest font-bold">AGD SCORE</div>
    </div>
  );
};