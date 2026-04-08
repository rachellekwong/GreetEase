import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TONES = ['formal', 'warm', 'fun', 'professional', 'casual', 'heartfelt'];

const emptyContact = {
  name: '', email: '', phone: '', telegram_chat_id: '', group: 'friends', tone_override: '', notes: '', is_active: true,
};

export default function ContactForm({ open, onClose, onSave, contact }) {
  const [form, setForm] = useState(emptyContact);

  // Only hydrate from props when editing an existing row — not when the dialog opens for "Add".
  // Drafts and field changes persist across open/close and when switching back to Add.
  useEffect(() => {
    if (contact?.id == null) return;
    setForm({ ...emptyContact, ...contact });
  }, [contact?.id]);

  const handleSave = () => {
    if (!form.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.group) {
      toast.error('Group is required');
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1234567890" />
            </div>
          </div>
          <div>
            <Label>Telegram chat ID</Label>
            <Input
              value={form.telegram_chat_id || ''}
              onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })}
              placeholder="e.g. 123456789 (user must /start your bot)"
            />
            <p className="text-xs text-slate-400 mt-1">Numeric ID from @userinfobot or your bot updates — required to send from Messages.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Group *</Label>
              <Select value={form.group} onValueChange={v => setForm({ ...form, group: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="friends">Friends</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tone Override</Label>
              <Select value={form.tone_override || 'none'} onValueChange={v => setForm({ ...form, tone_override: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use Default</SelectItem>
                  {TONES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any extra notes..." rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={form.is_active !== false} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              {contact ? 'Update' : 'Add Contact'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}