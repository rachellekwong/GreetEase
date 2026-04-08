import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Save, Copy, RefreshCw, Loader2, MessageCircle, CalendarClock, Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import SavedMessageCard from '../components/messages/SavedMessageCard';

const TONES = ['formal', 'warm', 'fun', 'professional', 'casual', 'heartfelt'];

export default function Messages() {
  const [selectedHoliday, setSelectedHoliday] = useState('');
  const [recipientMode, setRecipientMode] = useState('group');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [tone, setTone] = useState('warm');
  const [length, setLength] = useState('medium');
  const [sendTime, setSendTime] = useState('09:00');
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: holidays = [] } = useQuery({ queryKey: ['holidays'], queryFn: () => api.entities.Holiday.list() });
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => api.entities.Contact.list() });
  const { data: scheduled = [] } = useQuery({
    queryKey: ['scheduled'],
    queryFn: () => api.entities.ScheduledMessage.list('-created_date'),
  });

  const holiday = holidays.find((h) => h.id === selectedHoliday);

  // Auto-pick tone when holiday + group is selected
  const handleGroupChange = (group) => {
    setSelectedGroup(group);
    if (holiday) {
      const autoTone = holiday[`tone_${group}`];
      if (autoTone) setTone(autoTone);
    }
  };

  const handleHolidayChange = (id) => {
    setSelectedHoliday(id);
    const h = holidays.find((hh) => hh.id === id);
    if (h && recipientMode === 'group' && selectedGroup) {
      const autoTone = h[`tone_${selectedGroup}`];
      if (autoTone) setTone(autoTone);
    }
    if (h && recipientMode === 'individuals' && selectedContactIds.length > 0) {
      const first = contacts.find((c) => selectedContactIds.includes(c.id));
      if (first?.group && h[`tone_${first.group}`]) setTone(h[`tone_${first.group}`]);
    }
    setSendTime(h?.send_time || '09:00');
  };

  const toggleContact = (cid) => {
    setSelectedContactIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  const activeContacts = contacts.filter((c) => c.is_active !== false).sort((a, b) => a.name.localeCompare(b.name));

  const generateMessage = async () => {
    if (!selectedHoliday) { toast.error('Select a holiday first'); return; }
    if (!holiday) { toast.error('That holiday is no longer available — pick another'); return; }
    if (recipientMode === 'group' && !selectedGroup) { toast.error('Select a group first'); return; }
    if (recipientMode === 'individuals' && selectedContactIds.length === 0) {
      toast.error('Select at least one contact');
      return;
    }
    setGenerating(true);
    const lengthGuide = {
      short: '1-2 sentences only.',
      medium: '2-4 sentences.',
      long: '4-6 sentences with more warmth and detail.',
    };
    const emojiGuide = {
      formal: 'Use 1-2 subtle, professional emojis (e.g. 🎉 ✨).',
      professional: 'Use 1-2 subtle, professional emojis (e.g. 🎉 ✨).',
      warm: 'Use 2-3 warm, heartfelt emojis (e.g. 🌸 💛 😊).',
      heartfelt: 'Use 2-4 emotional, loving emojis (e.g. ❤️ 🥰 💖 🙏).',
      fun: 'Use 3-5 fun, energetic emojis (e.g. 🎊 🥳 😄 🎈 🙌).',
      casual: 'Use 2-4 relaxed, friendly emojis (e.g. 😊 🎉 👋 🌟).',
    };
    const audienceDesc =
      recipientMode === 'group'
        ? `a single individual who is a ${selectedGroup} contact`
        : `specific people you will send to: ${selectedContactIds
            .map((id) => contacts.find((c) => c.id === id))
            .filter(Boolean)
            .map((c) => `${c.name} (${c.group})`)
            .join(', ')}. Write one message body that works for all of them`;
    const prompt = `Write a ${tone} holiday greeting message for "${holiday.name}" addressed to ${audienceDesc}.
    ${holiday.description ? `Context: ${holiday.description}.` : ''}
    Keep it ${lengthGuide[length]} Be sincere, personal, and appropriate for the tone — write as if you are sending it to one specific person, not a group broadcast. ${emojiGuide[tone] || 'Include a few relevant emojis.'} Do not include subject lines, salutations like "Dear [Name]", or signatures. Just the message body.`;
    try {
      const result = await api.integrations.Core.InvokeLLM({ prompt });
      setMessage(result);
    } catch (e) {
      toast.error(e.message || 'Could not generate message');
    } finally {
      setGenerating(false);
    }
  };

  const saveMessage = async () => {
    if (!message || !holiday) {
      toast.error('Generate a message first, and select a holiday + recipients');
      return;
    }
    if (recipientMode === 'group' && !selectedGroup) {
      toast.error('Select a group');
      return;
    }
    if (recipientMode === 'individuals' && selectedContactIds.length === 0) {
      toast.error('Select at least one contact');
      return;
    }
    setSaving(true);
    const hhmm = sendTime || holiday.send_time || '09:00';
    const localIso = new Date(`${holiday.date}T${hhmm}:00`).toISOString();
    await api.entities.ScheduledMessage.create({
      holiday_id: holiday.id,
      holiday_name: holiday.name,
      holiday_date: holiday.date,
      holiday_send_time: hhmm,
      scheduled_at: localIso,
      target_mode: recipientMode,
      target_group: recipientMode === 'group' ? selectedGroup : '',
      target_contact_ids: recipientMode === 'individuals' ? selectedContactIds : [],
      tone,
      message,
      status: 'scheduled',
    });
    queryClient.invalidateQueries({ queryKey: ['scheduled'] });
    toast.success('Message saved & scheduled!');
    setMessage('');
    setSaving(false);
  };

  const deleteScheduled = async (msg) => {
    if (!confirm('Delete this scheduled message?')) return;
    await api.entities.ScheduledMessage.delete(msg.id);
    queryClient.invalidateQueries({ queryKey: ['scheduled'] });
    toast.success('Deleted');
  };

  const sendViaTelegram = async (msg, groupContacts) => {
    const items = groupContacts.map((c) => ({
      chat_id: String(c.telegram_chat_id).trim(),
      text: msg.message,
    }));
    try {
      const out = await api.telegram.send({ items });
      const okContacts = groupContacts.filter((c, i) => out.results?.[i]?.ok);
      if (okContacts.length === 0) {
        const err = out.results?.find((r) => r.error)?.error || 'Telegram send failed';
        toast.error(err);
        return;
      }
      await api.entities.ScheduledMessage.update(msg.id, {
        status: 'sent',
        sent_count: okContacts.length,
        dispatch_error: '',
      });
      for (const c of okContacts) {
        await api.entities.NotificationLog.create({
          contact_name: c.name,
          contact_email: c.email || '',
          contact_group: c.group,
          holiday_name: msg.holiday_name,
          message: msg.message,
          status: 'sent',
          sent_via: 'telegram',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      if (okContacts.length < groupContacts.length) {
        toast.success(`Sent to ${okContacts.length} of ${groupContacts.length} on Telegram`);
      } else {
        toast.success(`Sent to ${okContacts.length} contact(s) on Telegram`);
      }
    } catch (e) {
      toast.error(e.message || 'Telegram request failed — is the API running and TELEGRAM_BOT_TOKEN set?');
    }
  };

  const scheduled_sorted = scheduled.sort((a, b) => {
    const order = { scheduled: 0, failed: 0, draft: 1, sent: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Messages</h1>
        <p className="text-slate-500 mt-1">Generate, save, and send greetings on Telegram</p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="w-4 h-4" /> Generate
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <CalendarClock className="w-4 h-4" /> Scheduled
            {scheduled_sorted.filter(s => s.status === 'scheduled').length > 0 && (
              <span className="ml-1 bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {scheduled_sorted.filter(s => s.status === 'scheduled').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Config */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
              <h3 className="font-semibold text-slate-900">Configure</h3>
              <div>
                <Label>Holiday *</Label>
                <Select value={selectedHoliday} onValueChange={handleHolidayChange}>
                  <SelectTrigger><SelectValue placeholder="Select a holiday" /></SelectTrigger>
                  <SelectContent>
                    {holidays.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recipients *</Label>
                <Tabs value={recipientMode} onValueChange={setRecipientMode} className="w-full">
                  <TabsList className="bg-slate-100 h-auto p-1 w-full grid grid-cols-2">
                    <TabsTrigger value="group" className="gap-2 py-2 data-[state=active]:shadow-sm">
                      <Users className="w-4 h-4 shrink-0" />
                      Group
                    </TabsTrigger>
                    <TabsTrigger value="individuals" className="gap-2 py-2 data-[state=active]:shadow-sm">
                      <User className="w-4 h-4 shrink-0" />
                      Individuals
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {recipientMode === 'group' ? (
                <div>
                  <Label>Group *</Label>
                  <Select value={selectedGroup} onValueChange={handleGroupChange}>
                    <SelectTrigger><SelectValue placeholder="Pick group" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">Work</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="friends">Friends</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Select contacts *</Label>
                  <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {activeContacts.length === 0 ? (
                      <p className="text-xs text-slate-400 p-4">No active contacts. Add some on the Contacts tab.</p>
                    ) : (
                      activeContacts.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedContactIds.includes(c.id)}
                            onCheckedChange={() => toggleContact(c.id)}
                          />
                          <span className="text-sm font-medium text-slate-800 flex-1 min-w-0">{c.name}</span>
                          <span className="text-xs capitalize text-slate-500 shrink-0">{c.group}</span>
                          {String(c.telegram_chat_id || '').trim() ? (
                            <span className="text-[10px] text-emerald-600 font-medium shrink-0">TG</span>
                          ) : (
                            <span className="text-[10px] text-amber-600 shrink-0">no ID</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div>
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Length</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (1-2 sentences)</SelectItem>
                    <SelectItem value="medium">Medium (2-4 sentences)</SelectItem>
                    <SelectItem value="long">Long (4-6 sentences)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Send Time</Label>
                <Input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)} />
              </div>
              {selectedHoliday && recipientMode === 'group' && selectedGroup && (
                <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
                  Will send to <strong>{contacts.filter(c => c.group === selectedGroup && c.is_active !== false).length}</strong> active {selectedGroup} contacts
                  &nbsp;({contacts.filter(c => c.group === selectedGroup && c.is_active !== false && String(c.telegram_chat_id || '').trim()).length} with Telegram chat ID)
                </p>
              )}
              {selectedHoliday && recipientMode === 'individuals' && selectedContactIds.length > 0 && (
                <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
                  <strong>{selectedContactIds.length}</strong> selected ·{' '}
                  <strong>
                    {selectedContactIds.filter((id) => {
                      const c = contacts.find((x) => x.id === id);
                      return c && String(c.telegram_chat_id || '').trim();
                    }).length}
                  </strong>{' '}
                  with Telegram chat ID
                </p>
              )}
              <Button onClick={generateMessage} disabled={generating} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Message
              </Button>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Preview & Edit</h3>
                {message && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(message); toast.success('Copied'); }}>
                      <Copy className="w-4 h-4 text-slate-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={generateMessage} disabled={generating}>
                      <RefreshCw className={`w-4 h-4 text-slate-400 ${generating ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                )}
              </div>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Your AI-generated message will appear here. Edit freely before saving..."
                rows={9}
                className="resize-none text-sm"
              />
              {message && (
                <Button onClick={saveMessage} disabled={saving} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save & Schedule
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 bg-gradient-to-r from-sky-50 to-indigo-50 rounded-2xl p-5 border border-sky-100">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sky-900">How Telegram sending works</p>
                <p className="text-sm text-sky-800 mt-1">
                  Add each contact’s <strong>Telegram chat ID</strong> on the Contacts page. Create a bot with <strong>@BotFather</strong>, put <code className="text-xs bg-white/70 px-1 rounded">TELEGRAM_BOT_TOKEN</code> in <code className="text-xs bg-white/70 px-1 rounded">telegram_api.env</code>, restart the server.
                  Then: Generate → Save & Schedule → on <strong>Scheduled</strong>, expand and tap <strong>Send via Telegram</strong>.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6 space-y-4">
          {scheduled_sorted.length === 0 ? (
            <div className="text-center py-16">
              <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">No scheduled messages yet</p>
              <p className="text-sm text-slate-400 mt-1">Generate a message and save it to see it here</p>
            </div>
          ) : (
            scheduled_sorted.map(msg => (
              <SavedMessageCard
                key={msg.id}
                msg={msg}
                contacts={contacts}
                onDelete={deleteScheduled}
                onSendTelegram={sendViaTelegram}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}