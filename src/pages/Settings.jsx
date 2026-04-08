import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const TONES = ['formal', 'warm', 'fun', 'professional', 'casual', 'heartfelt'];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: settingsList = [], isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.entities.UserSettings.list(),
  });

  const settings = settingsList[0];

  const [form, setForm] = useState({
    default_tone_work: 'formal',
    default_tone_family: 'warm',
    default_tone_friends: 'fun',
    auto_send_enabled: true,
    notification_days_before: 0,
    sender_name: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        default_tone_work: settings.default_tone_work || 'formal',
        default_tone_family: settings.default_tone_family || 'warm',
        default_tone_friends: settings.default_tone_friends || 'fun',
        auto_send_enabled: settings.auto_send_enabled !== false,
        notification_days_before: settings.notification_days_before || 0,
        sender_name: settings.sender_name || '',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    if (settings) {
      await api.entities.UserSettings.update(settings.id, form);
    } else {
      await api.entities.UserSettings.create(form);
    }
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    toast.success('Settings saved');
    setSaving(false);
  };

  const exportData = async () => {
    const contacts = await api.entities.Contact.list();
    const holidays = await api.entities.Holiday.list();
    const logs = await api.entities.NotificationLog.list();
    const data = { contacts, holidays, logs, settings: form };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'holiday-notifier-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-slate-500 mt-1">Configure defaults and preferences</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
        <h3 className="font-semibold text-slate-900">Default Tones</h3>
        {['work', 'family', 'friends'].map(g => (
          <div key={g} className="flex items-center gap-4">
            <Label className="w-20 capitalize text-slate-600">{g}</Label>
            <Select value={form[`default_tone_${g}`]} onValueChange={v => setForm({ ...form, [`default_tone_${g}`]: v })}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
        <h3 className="font-semibold text-slate-900">Notification Options</h3>
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-Send Enabled</Label>
            <p className="text-xs text-slate-400 mt-0.5">Automatically send on holiday dates</p>
          </div>
          <Switch checked={form.auto_send_enabled} onCheckedChange={v => setForm({ ...form, auto_send_enabled: v })} />
        </div>
        <div>
          <Label>Days Before Holiday</Label>
          <Input
            type="number"
            min={0}
            max={30}
            value={form.notification_days_before}
            onChange={e => setForm({ ...form, notification_days_before: parseInt(e.target.value) || 0 })}
            className="w-24 mt-1"
          />
          <p className="text-xs text-slate-400 mt-1">Send messages this many days before</p>
        </div>
        <div>
          <Label>Sender Name</Label>
          <Input value={form.sender_name} onChange={e => setForm({ ...form, sender_name: e.target.value })} placeholder="Your name" className="mt-1" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
        <Button variant="outline" onClick={exportData} className="gap-2">
          <Download className="w-4 h-4" /> Export All Data
        </Button>
      </div>
    </div>
  );
}