import React from 'react';
import { Briefcase, Heart, PartyPopper } from 'lucide-react';

const groupConfig = {
  work: { icon: Briefcase, color: 'bg-blue-500', lightColor: 'bg-blue-50', textColor: 'text-blue-700' },
  family: { icon: Heart, color: 'bg-rose-500', lightColor: 'bg-rose-50', textColor: 'text-rose-700' },
  friends: { icon: PartyPopper, color: 'bg-amber-500', lightColor: 'bg-amber-50', textColor: 'text-amber-700' },
};

export default function GroupSummary({ contacts }) {
  const groups = ['work', 'family', 'friends'];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <h3 className="font-semibold text-slate-900 mb-5">Contact Groups</h3>
      <div className="space-y-4">
        {groups.map(g => {
          const config = groupConfig[g];
          const Icon = config.icon;
          const count = contacts.filter(c => c.group === g).length;
          const active = contacts.filter(c => c.group === g && c.is_active !== false).length;
          const total = contacts.length || 1;
          const pct = Math.round((count / total) * 100);
          
          return (
            <div key={g}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.lightColor}`}>
                    <Icon className={`w-4 h-4 ${config.textColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 capitalize">{g}</p>
                    <p className="text-xs text-slate-400">{active} active of {count}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700">{count}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${config.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}