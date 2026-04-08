import React from 'react';
import { Mail, Phone, Send, Pencil, Trash2, Briefcase, Heart, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';

const groupConfig = {
  work: { icon: Briefcase, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  family: { icon: Heart, bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' },
  friends: { icon: PartyPopper, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
};

export default function ContactCard({ contact, onEdit, onDelete }) {
  const config = groupConfig[contact.group] || groupConfig.friends;
  const Icon = config.icon;

  return (
    <div className={`bg-white rounded-2xl border ${contact.is_active === false ? 'border-slate-200 opacity-60' : 'border-slate-100'} p-5 hover:shadow-md transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${config.bg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${config.text}`} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{contact.name}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge} capitalize`}>{contact.group}</span>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(contact)}>
            <Pencil className="w-3.5 h-3.5 text-slate-400" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(contact)}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {contact.email && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{contact.phone}</span>
          </div>
        )}
        {contact.telegram_chat_id && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Send className="w-3.5 h-3.5 text-sky-500" />
            <span className="font-mono text-xs">TG {contact.telegram_chat_id}</span>
          </div>
        )}
      </div>
      {contact.tone_override && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">Tone: <span className="font-medium text-slate-600 capitalize">{contact.tone_override}</span></p>
        </div>
      )}
    </div>
  );
}