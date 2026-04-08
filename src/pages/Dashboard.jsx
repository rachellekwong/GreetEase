import React from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Users, CalendarHeart, Send, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatsCard from '../components/dashboard/StatsCard';
import UpcomingHolidays from '../components/dashboard/UpcomingHolidays';
import RecentActivity from '../components/dashboard/RecentActivity';
import GroupSummary from '../components/dashboard/GroupSummary';

export default function Dashboard() {
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.entities.Contact.list(),
  });
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.entities.Holiday.list(),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.entities.NotificationLog.list('-created_date', 20),
  });

  const sentCount = logs.filter(l => l.status === 'sent').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage your holiday greetings at a glance</p>
        </div>
        <div className="flex gap-2">
          <Link to="/Contacts">
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Contact
            </Button>
          </Link>
          <Link to="/Holidays">
            <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Holiday
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Contacts" value={contacts.length} icon={Users} color="blue" />
        <StatsCard title="Holidays" value={holidays.length} icon={CalendarHeart} color="indigo" />
        <StatsCard title="Sent" value={sentCount} icon={Send} color="emerald" />
        <StatsCard
          title="Groups"
          value={3}
          icon={Users}
          color="amber"
          subtitle="work · family · friends"
        />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <UpcomingHolidays holidays={holidays} />
          <RecentActivity logs={logs} />
        </div>
        <div>
          <GroupSummary contacts={contacts} />
        </div>
      </div>
    </div>
  );
}