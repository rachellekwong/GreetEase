import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import ContactCard from '../components/contacts/ContactCard';
import ContactForm from '../components/contacts/ContactForm';

export default function Contacts() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const {
    data: contacts = [],
    isLoading,
    isError: contactsError,
    error: contactsErrorObj,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const data = await api.entities.Contact.list('-created_date');
      return Array.isArray(data) ? data : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Contact.create(data),
    onSuccess: async (created) => {
      if (created?.id) {
        queryClient.setQueryData(['contacts'], (old) => {
          const prev = Array.isArray(old) ? old : [];
          if (prev.some((c) => c.id === created.id)) return prev;
          return [created, ...prev];
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['contacts'], refetchType: 'all' });
      toast.success('Contact saved across the app');
      setShowForm(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message || 'Could not add contact — start the API with npm run dev:all or npm run server'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Contact.update(id, data),
    onSuccess: async (updated) => {
      if (updated?.id) {
        queryClient.setQueryData(['contacts'], (old) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.map((c) => (c.id === updated.id ? updated : c));
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['contacts'], refetchType: 'all' });
      toast.success('Contact updated');
      setShowForm(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message || 'Could not update contact'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Contact.delete(id),
    onSuccess: async (_, id) => {
      queryClient.setQueryData(['contacts'], (old) => {
        const prev = Array.isArray(old) ? old : [];
        return prev.filter((c) => c.id !== id);
      });
      await queryClient.invalidateQueries({ queryKey: ['contacts'], refetchType: 'all' });
      toast.success('Contact deleted');
    },
  });

  const filtered = contacts
    .filter(c => tab === 'all' || c.group === tab)
    .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));

  const handleSave = (raw) => {
    const { id: _id, created_date: _cd, ...data } = raw;
    if (editing?.id != null) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (contact) => { setEditing(contact); setShowForm(true); };
  const handleDelete = (contact) => { if (confirm(`Delete ${contact.name}?`)) deleteMutation.mutate(contact.id); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Contacts</h1>
          <p className="text-slate-500 mt-1">{contacts.length} contacts across 3 groups</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      {contactsError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>
            Could not load contacts from the server{contactsErrorObj?.message ? `: ${contactsErrorObj.message}` : ''}.
            Run <code className="rounded bg-amber-100/80 px-1">npm run dev:all</code> so the API runs on port 3030, or <code className="rounded bg-amber-100/80 px-1">npm run server</code> in a separate terminal.
          </span>
          <Button type="button" variant="outline" size="sm" className="shrink-0 border-amber-300" onClick={() => refetchContacts()}>
            Retry
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="work" className="data-[state=active]:text-blue-700">Work</TabsTrigger>
            <TabsTrigger value="family" className="data-[state=active]:text-rose-700">Family</TabsTrigger>
            <TabsTrigger value="friends" className="data-[state=active]:text-amber-700">Friends</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." className="pl-10" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400">No contacts found</p>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Add your first contact
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ContactCard key={c.id} contact={c} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <ContactForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
        contact={editing}
      />
    </div>
  );
}