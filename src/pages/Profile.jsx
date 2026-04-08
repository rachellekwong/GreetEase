import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, CheckCircle2, Loader2, RefreshCw, Save, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const autoRefreshAttempted = useRef(false);
  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api.workspace.get(),
  });
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    telegram_bot_token: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [refreshingBot, setRefreshingBot] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    const fromWsName = (workspace.display_name ?? '').trim();
    const fromWsEmail = (workspace.email ?? '').trim();
    const authName = (user?.name ?? '').trim();
    const authEmail = (user?.email ?? '').trim();
    const display_name =
      fromWsName ||
      (authName && authName !== 'Local User' ? authName : '') ||
      'Rachelle';
    const email = fromWsEmail || authEmail || '';

    setForm((prev) => ({
      ...prev,
      display_name,
      email,
      telegram_bot_token: '',
    }));
  }, [workspace, user]);

  useEffect(() => {
    if (!workspace || autoRefreshAttempted.current) return;
    if (workspace.telegram_token_configured && !(workspace.telegram_bot_username || '').trim()) {
      autoRefreshAttempted.current = true;
      api.workspace
        .refreshTelegramBot()
        .then(() => queryClient.invalidateQueries({ queryKey: ['workspace'] }))
        .catch(() => {
          autoRefreshAttempted.current = false;
        });
    }
  }, [workspace, queryClient]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.workspace.patch({
        display_name: form.display_name,
        email: form.email,
      });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Profile saved');
    } catch (e) {
      toast.error(e.message || 'Could not save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveToken = async () => {
    const t = form.telegram_bot_token.trim();
    if (!t) {
      toast.error('Paste a bot token first, or clear the field and use Save empty only to remove a saved token.');
      return;
    }
    setSavingToken(true);
    try {
      const res = await api.workspace.patch({ telegram_bot_token: t });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setForm((prev) => ({ ...prev, telegram_bot_token: '' }));
      if (res?.bot_sync && !res.bot_sync.ok) {
        toast.error(res.bot_sync.error || 'Token saved but Telegram did not confirm it.');
      } else {
        toast.success('Bot token saved');
      }
    } catch (e) {
      toast.error(e.message || 'Could not save token');
    } finally {
      setSavingToken(false);
    }
  };

  const clearStoredToken = async () => {
    setSavingToken(true);
    try {
      await api.workspace.patch({ telegram_bot_token: '' });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Removed token from app data (env token still works if set)');
    } catch (e) {
      toast.error(e.message || 'Could not clear token');
    } finally {
      setSavingToken(false);
    }
  };

  const refreshBot = async () => {
    setRefreshingBot(true);
    try {
      await api.workspace.refreshTelegramBot();
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Bot details updated from Telegram');
    } catch (e) {
      toast.error(e.message || 'Could not refresh bot');
    } finally {
      setRefreshingBot(false);
    }
  };

  if (isLoading && !workspace) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const sourceLabel =
    workspace?.telegram_token_source === 'env'
      ? 'Loaded from telegram_api.env'
      : workspace?.telegram_token_source === 'workspace'
        ? 'Saved in app data'
        : 'Not configured';

  const botConfigured = Boolean(workspace?.telegram_token_configured);
  /** Dummy value so the browser paints password bullets — the real token never leaves the server. */
  const MASKED_TOKEN_DISPLAY = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  const botHandle =
    workspace?.telegram_bot_username ? `@${workspace.telegram_bot_username}` : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Profile</h1>
        <p className="text-slate-500 mt-1">Your workspace name and the Telegram bot connected to GreetEase</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <UserCircle className="w-5 h-5 text-indigo-600" />
          Your account
        </div>
        <div>
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            className="mt-1"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="How you want to be shown in the app"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="mt-1"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </div>
        <Button onClick={saveProfile} disabled={savingProfile}>
          {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save profile
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <Bot className="w-5 h-5 text-indigo-600" />
          Telegram bot
        </div>
        {botConfigured ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-medium text-emerald-900">Bot is configured</p>
              <p className="text-xs text-emerald-800/80 mt-0.5">{sourceLabel}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">Not configured</p>
            <p className="text-xs text-amber-800/80 mt-1">
              The API needs a token (see <code className="text-amber-900/90">telegram_api.env</code>) or paste one
              below. Start the backend with <code className="text-amber-900/90">npm run server</code> or{' '}
              <code className="text-amber-900/90">npm run dev:all</code>.
            </p>
          </div>
        )}

        <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-1">
          {botHandle || workspace?.telegram_bot_first_name ? (
            <>
              {botHandle && (
                <p className="font-medium text-slate-900">{botHandle}</p>
              )}
              {workspace?.telegram_bot_first_name ? (
                <p className="text-sm text-slate-600">{workspace.telegram_bot_first_name}</p>
              ) : null}
              {workspace?.telegram_bot_id != null ? (
                <p className="text-xs text-slate-400">Bot id · {String(workspace.telegram_bot_id)}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              No bot details yet. Save a token below, then refresh from Telegram.
            </p>
          )}
        </div>

        <Button type="button" variant="outline" onClick={refreshBot} disabled={refreshingBot || !workspace?.telegram_token_configured}>
          {refreshingBot ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh from Telegram
        </Button>

        <div className="pt-2 border-t border-slate-100 space-y-4">
          {botConfigured ? (
            <div>
              <Label htmlFor="telegram_bot_token_masked">Bot token</Label>
              <Input
                id="telegram_bot_token_masked"
                type="password"
                readOnly
                tabIndex={-1}
                autoComplete="off"
                value={MASKED_TOKEN_DISPLAY}
                className="mt-1 font-mono text-sm bg-slate-50 text-slate-800 cursor-default select-none"
                aria-label="Token is configured on the server (masked)"
              />
              <p className="text-xs text-slate-500 mt-1">
                Shown as dots only — the real token is not sent to your browser. {sourceLabel}.
              </p>
            </div>
          ) : null}

          <div>
            <Label htmlFor="telegram_bot_token">
              {botConfigured ? 'Save token in app (optional)' : 'Bot token (optional — stored in local JSON for demo)'}
            </Label>
            <Input
              id="telegram_bot_token"
              type="password"
              autoComplete="off"
              className="mt-1 font-mono text-sm"
              value={form.telegram_bot_token}
              onChange={(e) => setForm({ ...form, telegram_bot_token: e.target.value })}
              placeholder={
                botConfigured
                  ? 'Paste only if you want a copy stored in greetease.json…'
                  : 'Paste token from @BotFather'
              }
            />
            <p className="text-xs text-slate-400 mt-1">
              Prefer <code className="text-slate-600">telegram_api.env</code> for secrets on a real deployment.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveToken} disabled={savingToken}>
              {savingToken ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save token
            </Button>
            {workspace?.telegram_token_source === 'workspace' ? (
              <Button type="button" variant="ghost" className="text-red-600" onClick={clearStoredToken} disabled={savingToken}>
                Remove stored token
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
