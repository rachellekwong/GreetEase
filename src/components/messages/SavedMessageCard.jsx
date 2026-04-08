import React, { useState } from 'react';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { Send, Trash2, Calendar, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const groupConfig = {
  work: { badge: 'bg-blue-100 text-blue-700' },
  family: { badge: 'bg-rose-100 text-rose-700' },
  friends: { badge: 'bg-amber-100 text-amber-700' },
};
const statusConfig = {
  scheduled: 'bg-indigo-100 text-indigo-700',
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  draft: 'bg-slate-100 text-slate-600',
};

export default function SavedMessageCard({ msg, contacts, onDelete, onSendTelegram }) {
  const [expanded, setExpanded] = useState(false);
  const sendTime = String(msg.holiday_send_time || '').trim();

  const hDate = parseISO(msg.holiday_date);
  const today = startOfDay(new Date());
  const thisYear = new Date(today.getFullYear(), hDate.getMonth(), hDate.getDate());
  const targetDate = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, hDate.getMonth(), hDate.getDate());
  const daysUntil = differenceInDays(targetDate, today);

  const isIndividuals =
    msg.target_mode === 'individuals' &&
    Array.isArray(msg.target_contact_ids) &&
    msg.target_contact_ids.length > 0;
  const idSet = isIndividuals ? new Set(msg.target_contact_ids.map((x) => String(x))) : null;

  const groupContacts = contacts.filter((c) => {
    if (c.is_active === false || !String(c.telegram_chat_id || '').trim()) return false;
    if (isIndividuals) return idSet.has(String(c.id));
    return c.group === msg.target_group;
  });
  const canSendImmediately = msg.status === 'scheduled' || msg.status === 'failed';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex flex-col items-center justify-center shrink-0">
            <span className="text-xs font-bold text-indigo-600 uppercase">{format(targetDate, 'MMM')}</span>
            <span className="text-lg font-bold text-indigo-700 leading-none">{format(targetDate, 'd')}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900">{msg.holiday_name}</p>
              {isIndividuals ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-800">
                  Individuals
                </span>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${groupConfig[msg.target_group]?.badge}`}>
                  {msg.target_group}
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusConfig[msg.status] || statusConfig.draft}`}
              >
                {msg.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                {sendTime ? ` at ${sendTime}` : ''}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {groupContacts.length} with Telegram chat ID
              </span>
              {msg.tone && (
                <span className="flex items-center gap-1 capitalize">
                  <Clock className="w-3 h-3" /> {msg.tone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(msg)}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
          {msg.status === 'failed' && msg.dispatch_error && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <span className="font-semibold">Did not deliver: </span>
              {msg.dispatch_error}
            </p>
          )}
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 whitespace-pre-wrap">{msg.message}</p>
          {groupContacts.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Will send to ({groupContacts.length}):</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {groupContacts.slice(0, 8).map(c => (
                  <span key={c.id} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">{c.name}</span>
                ))}
                {groupContacts.length > 8 && <span className="text-xs text-slate-400">+{groupContacts.length - 8} more</span>}
              </div>
              <Button
                type="button"
                disabled={!canSendImmediately}
                onClick={() => canSendImmediately && onSendTelegram(msg, groupContacts)}
                className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                size="sm"
              >
                <Send className="w-4 h-4" />
                {canSendImmediately
                  ? msg.status === 'failed'
                    ? `Retry Telegram (${groupContacts.length})`
                    : `Send via Telegram (${groupContacts.length})`
                  : 'Already sent'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
              {isIndividuals
                ? '⚠️ None of the selected contacts have a Telegram chat ID saved (edit them on the Contacts tab).'
                : (
                    <>
                      ⚠️ No contacts in <span className="font-medium capitalize">{msg.target_group}</span> have a Telegram chat ID saved (edit contacts on the Contacts tab).
                    </>
                  )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}