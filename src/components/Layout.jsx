import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarHeart,
  MessageSquareText,
  MessageCircle,
  Activity,
  Bell,
  Settings,
  UserCircle,
} from 'lucide-react';

const navItems = [
  { path: '/Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/Contacts', label: 'Contacts', icon: Users },
  { path: '/Holidays', label: 'Holidays', icon: CalendarHeart },
  { path: '/Messages', label: 'Messages', icon: MessageSquareText },
  { path: '/ChatHistory', label: 'Chats', icon: MessageCircle },
  { path: '/Activity', label: 'Activity', icon: Activity },
];

const profileNavItem = { path: '/Profile', label: 'Profile', icon: UserCircle };

const navLinkClass = (active) =>
  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
    active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
  }`;

export default function Layout() {
  const location = useLocation();
  const ProfileIcon = profileNavItem.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed inset-y-0 z-30">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 text-lg tracking-tight">GreetEase</h1>
              <p className="text-xs text-slate-400">Smart greetings</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={navLinkClass(active)}>
                <item.icon className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <Link
            to={profileNavItem.path}
            className={`${navLinkClass(location.pathname === profileNavItem.path)} w-full`}
          >
            <ProfileIcon
              className={`w-5 h-5 ${location.pathname === profileNavItem.path ? 'text-indigo-600' : 'text-slate-400'}`}
            />
            {profileNavItem.label}
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 inset-x-0 bg-white border-b border-slate-200 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900">GreetEase</span>
        </div>
        <Link to="/Settings" className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <Settings className="w-5 h-5 text-slate-500" />
        </Link>
      </div>

      {/* Mobile Bottom Tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 flex">
        {[...navItems, profileNavItem].map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center py-2 gap-1 text-[10px] sm:text-xs font-medium transition-all ${
                active ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-full px-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 mt-14 md:mt-0 mb-16 md:mb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}