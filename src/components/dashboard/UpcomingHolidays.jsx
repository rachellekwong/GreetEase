import React from 'react';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { CalendarHeart, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function UpcomingHolidays({ holidays }) {
  const today = new Date();
  
  const upcoming = holidays
    .filter(h => h.is_active !== false && h?.date)
    .map(h => {
      const hDate = parseISO(h.date);
      if (!isValid(hDate)) return null;
      const thisYear = new Date(today.getFullYear(), hDate.getMonth(), hDate.getDate());
      const target = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, hDate.getMonth(), hDate.getDate());
      return { ...h, nextDate: target, daysUntil: differenceInDays(target, today) };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-slate-900">Upcoming Holidays</h3>
        <Link to="/Holidays" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No holidays added yet</p>
      ) : (
        <div className="space-y-3">
          {upcoming.map(h => (
            <div key={h.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex flex-col items-center justify-center shrink-0">
                <span className="text-xs font-bold text-indigo-600 uppercase">{format(h.nextDate, 'MMM')}</span>
                <span className="text-lg font-bold text-indigo-700 leading-none">{format(h.nextDate, 'd')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{h.name}</p>
                <p className="text-xs text-slate-400">
                  {h.daysUntil === 0 ? 'Today!' : h.daysUntil === 1 ? 'Tomorrow' : `In ${h.daysUntil} days`}
                </p>
              </div>
              {h.daysUntil <= 3 && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">Soon</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}