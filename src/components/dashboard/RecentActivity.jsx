import React from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Send, AlertCircle, Clock } from 'lucide-react';

const statusConfig = {
  sent: { icon: Send, color: 'text-emerald-600 bg-emerald-50', label: 'Sent' },
  failed: { icon: AlertCircle, color: 'text-red-600 bg-red-50', label: 'Failed' },
  pending: { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'Pending' },
};

const groupColors = {
  work: 'bg-blue-100 text-blue-700',
  family: 'bg-rose-100 text-rose-700',
  friends: 'bg-amber-100 text-amber-700',
};

export default function RecentActivity({ logs }) {
  const recent = logs.slice(0, 8);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
        <Link to="/Activity" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View all →</Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No notifications sent yet</p>
      ) : (
        <div className="space-y-3">
          {recent.map(log => {
            const config = statusConfig[log.status] || statusConfig.pending;
            const Icon = config.icon;
            return (
              <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {log.holiday_name} → {log.contact_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${groupColors[log.contact_group] || 'bg-slate-100 text-slate-600'}`}>
                      {log.contact_group}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(log.created_date), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}