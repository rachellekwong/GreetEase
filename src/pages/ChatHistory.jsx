import React, { useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  MessageCircle,
  RefreshCw,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const groupColors = {
  work: 'bg-blue-100 text-blue-700',
  family: 'bg-rose-100 text-rose-700',
  friends: 'bg-amber-100 text-amber-700',
};

function inboundLabel(row) {
  if (row.contact_name) return row.contact_name;
  const parts = [row.from_first_name, row.from_last_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  if (row.from_username) return `@${row.from_username}`;
  return `Chat ${row.chat_id}`;
}

/**
 * @param {Array} inbound - telegramInbound rows
 * @param {Array} logs - notification logs (Telegram sends)
 * @param {Array} contacts
 */
function buildChatThreads(inbound, logs, contacts) {
  const byChat = new Map();

  const getThread = (chatId, fallbackName) => {
    const key = String(chatId);
    if (!byChat.has(key)) {
      byChat.set(key, { chat_id: key, messages: [], fallbackName: fallbackName || 'Unknown' });
    }
    return byChat.get(key);
  };

  const resolveContactByChatId = (chatId) =>
    contacts.find((c) => String(c.telegram_chat_id || '').trim() === String(chatId));

  const resolveLogToChatId = (log) => {
    const c =
      contacts.find((x) => x.name === log.contact_name && x.group === log.contact_group) ||
      contacts.find((x) => x.name === log.contact_name);
    return c ? String(c.telegram_chat_id || '').trim() : '';
  };

  for (const row of inbound) {
    const cid = String(row.chat_id);
    const t = getThread(cid, inboundLabel(row));
    t.messages.push({
      kind: 'in',
      id: `in-${row.id}`,
      text: row.text,
      at: row.created_date,
    });
  }

  for (const log of logs) {
    if (log.status === 'failed') continue;
    if (log.sent_via && log.sent_via !== 'telegram') continue;
    const cid = resolveLogToChatId(log);
    if (!cid) continue;
    const t = getThread(cid, log.contact_name);
    t.messages.push({
      kind: 'out',
      id: `out-${log.id}`,
      text: log.message,
      at: log.created_date,
      meta: log.holiday_name,
    });
  }

  const threads = [...byChat.values()].map((t) => {
    const c = resolveContactByChatId(t.chat_id);
    const displayName = c?.name || t.fallbackName;
    const sorted = [...t.messages].sort((a, b) => new Date(a.at) - new Date(b.at));
    const last = sorted[sorted.length - 1];
    return {
      chat_id: t.chat_id,
      displayName,
      group: c?.group,
      messages: sorted,
      lastAt: last?.at,
      preview: String(last?.text || '').slice(0, 100),
    };
  });

  threads.sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
  return threads;
}

export default function ChatHistory() {
  const queryClient = useQueryClient();
  const [openChatId, setOpenChatId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [sendingChatId, setSendingChatId] = useState(null);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.entities.Contact.list(),
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.entities.NotificationLog.list('-created_date', 400),
  });

  const { data: inbound = [], isLoading: inboundLoading } = useQuery({
    queryKey: ['telegram-inbound'],
    queryFn: () => api.telegram.listInbound('-created_date', 400),
    refetchInterval: 35_000,
  });

  const chatThreads = useMemo(
    () => buildChatThreads(inbound, logs, contacts),
    [inbound, logs, contacts]
  );

  const syncMutation = useMutation({
    mutationFn: () => api.telegram.syncInbound(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['telegram-inbound'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      const n = data?.ingested ?? 0;
      if (n > 0) {
        toast.success(`Synced ${n} new ${n === 1 ? 'message' : 'messages'}`);
      } else {
        toast.info('Chat history is up to date');
      }
    },
    onError: (err) => {
      toast.error(err?.message || 'Could not sync Telegram');
    },
  });

  const toggleChat = (chatId) => {
    setOpenChatId((id) => (id === chatId ? null : chatId));
  };

  const sendQuickReply = async (thread) => {
    const chatId = thread.chat_id;
    const text = String(replyDrafts[chatId] || '').trim();
    if (!text) {
      toast.error('Type a message first');
      return;
    }
    const contact = contacts.find((c) => String(c.telegram_chat_id || '').trim() === String(chatId));
    setSendingChatId(chatId);
    try {
      const out = await api.telegram.send({ items: [{ chat_id: chatId, text }] });
      const first = out.results?.[0];
      if (!first?.ok) {
        toast.error(first?.error || 'Telegram send failed');
        return;
      }
      await api.entities.NotificationLog.create({
        contact_name: contact?.name || thread.displayName,
        contact_email: contact?.email || '',
        contact_group: contact?.group || thread.group || 'friends',
        holiday_name: 'Chat reply',
        message: text,
        status: 'sent',
        sent_via: 'telegram',
      });
      setReplyDrafts((d) => {
        const next = { ...d };
        delete next[chatId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['logs'], refetchType: 'all' });
      toast.success('Message sent');
    } catch (e) {
      toast.error(e?.message || 'Send failed — is the API running?');
    } finally {
      setSendingChatId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Chat history</h1>
        <p className="text-slate-500 mt-1">Telegram conversations with your contacts — read threads and reply</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-500">
          Open a conversation to read the thread and <strong>type a reply</strong> — it sends through your bot and
          appears here. Outbound from Messages shows up when the contact matches your address book.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0 self-end sm:self-auto"
          disabled={syncMutation.isPending}
          onClick={() => syncMutation.mutate()}
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sync Telegram
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {inboundLoading || logsLoading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : chatThreads.length === 0 ? (
          <div className="p-12 text-center">
            <MessageCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No conversations yet</p>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Send something from Messages or sync when someone texts your bot. Outbound only appears if the
              contact has a matching name in Contacts with a Telegram chat ID.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {chatThreads.map((thread) => {
              const open = openChatId === thread.chat_id;
              const initial = thread.displayName.trim().charAt(0).toUpperCase() || '?';
              return (
                <li key={thread.chat_id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    className="w-full flex items-start gap-4 p-4 hover:bg-slate-50 text-left transition-colors"
                    onClick={() => toggleChat(thread.chat_id)}
                  >
                    <div className="w-11 h-11 rounded-full bg-sky-100 text-sky-800 font-semibold flex items-center justify-center shrink-0 text-sm">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{thread.displayName}</p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">ID {thread.chat_id}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {thread.lastAt && (
                            <span className="text-[11px] text-slate-400 whitespace-nowrap">
                              {format(new Date(thread.lastAt), 'MMM d, h:mm a')}
                            </span>
                          )}
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {thread.group && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${groupColors[thread.group] || 'bg-slate-100 text-slate-600'}`}
                          >
                            {thread.group}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {thread.messages.length} {thread.messages.length === 1 ? 'message' : 'messages'}
                        </span>
                      </div>
                      {!open && thread.preview && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{thread.preview}</p>
                      )}
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-slate-100 bg-slate-50/90 px-3 py-4 sm:px-6 space-y-4">
                      <div className="max-h-[28rem] overflow-y-auto space-y-3 pr-1">
                        {thread.messages.map((m) =>
                          m.kind === 'in' ? (
                            <div key={m.id} className="flex justify-start">
                              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-bl-md bg-white border border-slate-200 shadow-sm px-3.5 py-2.5">
                                <p className="text-xs font-medium text-sky-700 mb-1">
                                  {thread.displayName?.trim()
                                    ? `${thread.displayName.trim()} wrote`
                                    : 'They wrote'}
                                </p>
                                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{m.text}</p>
                                <p className="text-[10px] text-slate-400 mt-1.5">
                                  {m.at ? format(new Date(m.at), 'MMM d, yyyy · h:mm a') : ''}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div key={m.id} className="flex justify-end">
                              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-emerald-600 text-white shadow-sm px-3.5 py-2.5">
                                <p className="text-xs font-medium text-emerald-100 mb-1">You sent</p>
                                <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                                {m.meta && (
                                  <p className="text-[11px] text-emerald-200/90 mt-1">{m.meta}</p>
                                )}
                                <p className="text-[10px] text-emerald-200/80 mt-1.5">
                                  {m.at ? format(new Date(m.at), 'MMM d, yyyy · h:mm a') : ''}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <Textarea
                          placeholder={`Message ${thread.displayName}…`}
                          rows={3}
                          className="resize-none text-sm min-h-[4.5rem] border-slate-200"
                          value={replyDrafts[thread.chat_id] || ''}
                          onChange={(e) =>
                            setReplyDrafts((d) => ({ ...d, [thread.chat_id]: e.target.value }))
                          }
                          disabled={sendingChatId === thread.chat_id}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              sendQuickReply(thread);
                            }
                          }}
                        />
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            ⌘/Ctrl + Enter to send
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2 bg-sky-600 hover:bg-sky-700 text-white ml-auto"
                            disabled={sendingChatId === thread.chat_id}
                            onClick={() => sendQuickReply(thread)}
                          >
                            {sendingChatId === thread.chat_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            Send
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
