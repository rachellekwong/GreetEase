import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, CalendarHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { toast } from 'sonner';
import HolidayForm from '../components/holidays/HolidayForm';

const groupBadge = {
  work: 'bg-blue-100 text-blue-700',
  family: 'bg-rose-100 text-rose-700',
  friends: 'bg-amber-100 text-amber-700',
};

export default function Holidays() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.entities.Holiday.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Holiday.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holidays'], refetchType: 'all' });
      toast.success('Holiday saved — visible on Dashboard, Messages, and here');
      setShowForm(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message || 'Could not add holiday — start the API with npm run dev:all or npm run server'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Holiday.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holidays'], refetchType: 'all' });
      toast.success('Holiday updated');
      setShowForm(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message || 'Could not update holiday'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Holiday.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holidays'], refetchType: 'all' });
      toast.success('Holiday deleted');
    },
  });

  const filtered = holidays.filter(h => !search || h.name?.toLowerCase().includes(search.toLowerCase()));

  const getNextDate = (h) => {
    const today = new Date();
    if (!h?.date) return new Date(NaN);
    const hDate = parseISO(h.date);
    if (!isValid(hDate)) return new Date(NaN);
    if (h.recurrence === 'yearly') {
      const thisYear = new Date(today.getFullYear(), hDate.getMonth(), hDate.getDate());
      return thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, hDate.getMonth(), hDate.getDate());
    }
    return hDate;
  };

  const handleSave = (raw) => {
    const { id: _id, created_date: _cd, ...data } = raw;
    if (editing?.id != null) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Holidays</h1>
          <p className="text-slate-500 mt-1">Manage festivals and holidays</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Add Holiday
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search holidays..." className="pl-10" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CalendarHeart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No holidays found</p>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Add your first holiday
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered
            .map(h => {
              const nextDate = getNextDate(h);
              if (!isValid(nextDate)) return null;
              return { ...h, nextDate, daysUntil: differenceInDays(nextDate, new Date()) };
            })
            .filter(Boolean)
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .map(h => (
            <div key={h.id} className={`bg-white rounded-2xl border ${h.is_active === false ? 'border-slate-200 opacity-60' : 'border-slate-100'} p-3 sm:p-5 hover:shadow-md transition-all duration-300 group`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-indigo-50 flex flex-col items-center justify-center shrink-0">
                <span className="text-xs font-bold text-indigo-600 uppercase">{format(h.nextDate, 'MMM')}</span>
                <span className="text-lg sm:text-xl font-bold text-indigo-700 leading-none">{format(h.nextDate, 'd')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-slate-900 text-sm sm:text-base">{h.name}</p>
                  {h.recurrence === 'yearly' && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Yearly</span>
                  )}
                  {h.daysUntil <= 7 && h.daysUntil >= 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                      {h.daysUntil === 0 ? 'Today!' : h.daysUntil === 1 ? 'Tomorrow' : `${h.daysUntil}d`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {(h.send_to_groups || []).map(g => (
                    <Badge key={g} variant="secondary" className={`${groupBadge[g]} text-xs capitalize px-1.5 py-0`}>{g}</Badge>
                  ))}
                  {h.send_time && <span className="text-xs text-slate-500">Send at {h.send_time}</span>}
                  {h.description && <span className="text-xs text-slate-400 truncate max-w-[120px] sm:max-w-none">{h.description}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => { setEditing(h); setShowForm(true); }}>
                  <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => { if (confirm(`Delete ${h.name}?`)) deleteMutation.mutate(h.id); }}>
                  <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400" />
                </Button>
              </div>
            </div>
            </div>
          ))}
        </div>
      )}

      <HolidayForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} holiday={editing} />
    </div>
  );
}