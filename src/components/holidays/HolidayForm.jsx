import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TONES = ['formal', 'warm', 'fun', 'professional', 'casual', 'heartfelt'];
const GROUPS = ['work', 'family', 'friends'];

const emptyHoliday = {
  name: '', date: '', send_time: '09:00', recurrence: 'yearly', description: '',
  tone_work: 'formal', tone_family: 'warm', tone_friends: 'fun',
  send_to_groups: ['work', 'family', 'friends'], is_active: true,
};

export default function HolidayForm({ open, onClose, onSave, holiday }) {
  const [form, setForm] = useState(emptyHoliday);

  // Only hydrate when editing an existing holiday — drafts persist when reopening or using Add.
  useEffect(() => {
    if (holiday?.id == null) return;
    setForm({ ...emptyHoliday, ...holiday });
  }, [holiday?.id]);

  const toggleGroup = (group) => {
    const current = form.send_to_groups || [];
    const next = current.includes(group) ? current.filter(g => g !== group) : [...current, group];
    setForm({ ...form, send_to_groups: next });
  };

  const handleSave = () => {
    if (!form.name?.trim()) {
      toast.error('Holiday name is required');
      return;
    }
    if (!form.date) {
      toast.error('Pick a date for the holiday');
      return;
    }
    const data = { ...form, name: form.name.trim() };
    delete data.personal_message;
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{holiday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Holiday Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Christmas" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Recurrence</Label>
              <Select value={form.recurrence} onValueChange={v => setForm({ ...form, recurrence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">One-time</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Send Time</Label>
            <Input
              type="time"
              value={form.send_time || ''}
              onChange={e => setForm({ ...form, send_time: e.target.value })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." rows={2} />
          </div>

          <div>
            <Label className="mb-2 block">Send to Groups</Label>
            <div className="flex gap-4">
              {GROUPS.map(g => (
                <label key={g} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={(form.send_to_groups || []).includes(g)} onCheckedChange={() => toggleGroup(g)} />
                  <span className="text-sm capitalize">{g}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="block">Tone per Group</Label>
            {GROUPS.map(g => (
              <div key={g} className="flex items-center gap-3">
                <span className="text-sm capitalize w-16 text-slate-600">{g}</span>
                <Select value={form[`tone_${g}`] || 'formal'} onValueChange={v => setForm({ ...form, [`tone_${g}`]: v })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={form.is_active !== false} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              {holiday ? 'Update' : 'Add Holiday'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}