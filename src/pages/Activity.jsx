import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import {
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  Users,
  MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const groupColors = {
  work: 'bg-blue-100 text-blue-700',
  family: 'bg-rose-100 text-rose-700',
  friends: 'bg-amber-100 text-amber-700',
};

const statusConfig = {
  sent: { icon: CheckCircle, color: 'text-emerald-500', label: 'Sent' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  pending: { icon: Clock, color: 'text-amber-400', label: 'Pending' },
};

const BATCH_GAP_MS = 120_000;

function groupOutboundLogs(logs) {
  if (!logs.length) return [];
  const sorted = [...logs].sort(
    (a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0)
  );
  const raw = [];
  let cur = null;
  for (const log of sorted) {
    const t = new Date(log.created_date || 0).getTime();
    const msg = String(log.message || '');
    const holiday = String(log.holiday_name || '');
    if (
      cur &&
      String(cur.holiday_name) === holiday &&
      String(cur.message || '') === msg &&
      t - cur.endTime <= BATCH_GAP_MS
    ) {
      cur.items.push(log);
      cur.endTime = t;
    } else {
      if (cur) raw.push(cur);
      cur = { items: [log], holiday_name: holiday, message: msg, startTime: t, endTime: t };
    }
  }
  if (cur) raw.push(cur);

  return raw
    .map((g) => {
      const items = g.items;
      const ids = items.map((i) => i.id).sort();
      return {
        key: ids.join('|'),
        holiday_name: items[0].holiday_name,
        message: items[0].message,
        contact_group: items[0].contact_group,
        displayTime: items[items.length - 1].created_date,
        items,
      };
    })
    .reverse();
}

function aggregateStatus(items) {
  if (items.some((i) => i.status === 'failed')) return 'failed';
  if (items.every((i) => i.status === 'sent')) return 'sent';
  return 'pending';
}

export default function Activity() {
  const [expandedKey, setExpandedKey] = useState(null);

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.entities.NotificationLog.list('-created_date', 400),
  });

  const outboundGroups = useMemo(() => groupOutboundLogs(logs), [logs]);

  const toggleExpand = (key) => {
    setExpandedKey((k) => (k === key ? null : key));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Recent Activity</h1>
        <p className="text-slate-500 mt-1">Outbound greeting sends on Telegram</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">
          <MessageCircle className="w-4 h-4 inline-block mr-1.5 text-sky-600 align-text-bottom" />
          Telegram threads and quick replies live on{' '}
          <Link to="/ChatHistory" className="font-medium text-indigo-600 hover:text-indigo-800">
            Chat history
          </Link>
          .
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
        {logsLoading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : outboundGroups.length === 0 ? (
          <div className="p-12 text-center">
            <Send className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No sends yet</p>
            <p className="text-sm text-slate-400 mt-1">Use Messages to send greetings on Telegram.</p>
          </div>
        ) : (
          outboundGroups.map((g) => {
            const n = g.items.length;
            const isMulti = n > 1;
            const expanded = expandedKey === g.key;
            const status = aggregateStatus(g.items);
            const statusMeta = statusConfig[status] || statusConfig.pending;
            const StatusIcon = statusMeta.icon;

            if (!isMulti) {
              const log = g.items[0];
              return (
                <div
                  key={`out-${log.id}`}
                  className="flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Send className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm">
                      {log.holiday_name} → {log.contact_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {log.contact_group && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${groupColors[log.contact_group] || 'bg-slate-100 text-slate-600'}`}
                        >
                          {log.contact_group}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {log.created_date ? format(new Date(log.created_date), 'MMM d, h:mm a') : ''}
                      </span>
                      <span className={`flex items-center gap-1 text-xs ${statusMeta.color}`}>
                        <StatusIcon className="w-3 h-3" /> {statusMeta.label}
                      </span>
                    </div>
                    {log.message && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2 whitespace-pre-wrap">{log.message}</p>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={g.key} className="divide-y divide-slate-50">
                <button
                  type="button"
                  className="w-full flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => toggleExpand(g.key)}
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-800 text-sm">
                        {g.holiday_name}
                        <span className="font-normal text-slate-500">
                          {' '}
                          · {n} {n === 1 ? 'person' : 'people'}
                        </span>
                      </p>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform mt-0.5 ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {g.contact_group && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${groupColors[g.contact_group] || 'bg-slate-100 text-slate-600'}`}
                        >
                          {g.contact_group}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {g.displayTime ? format(new Date(g.displayTime), 'MMM d, h:mm a') : ''}
                      </span>
                      <span className={`flex items-center gap-1 text-xs ${statusMeta.color}`}>
                        <StatusIcon className="w-3 h-3" /> {statusMeta.label}
                      </span>
                    </div>
                    {g.message && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2 whitespace-pre-wrap">{g.message}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {expanded ? 'Hide recipients' : 'Show who it was sent to'}
                    </p>
                  </div>
                </button>
                {expanded && (
                  <div className="bg-slate-50/80 px-4 py-3 pl-[4.5rem] space-y-2">
                    {g.items.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-slate-100 last:border-0"
                      >
                        <span className="font-medium text-slate-800">{log.contact_name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {log.contact_group && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${groupColors[log.contact_group] || 'bg-slate-100 text-slate-600'}`}
                            >
                              {log.contact_group}
                            </span>
                          )}
                          <span className={`text-xs ${(statusConfig[log.status] || statusConfig.pending).color}`}>
                            {(statusConfig[log.status] || statusConfig.pending).label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
