'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Command,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { request } from '@/lib/api';
import type { OrganizationSettings, SessionUser } from '@/lib/models';
import { AuditView } from './audit-view';
import { BranchesView } from './branches-view';
import { OverviewView } from './overview-view';
import { RolesView } from './roles-view';
import { SettingsView } from './settings-view';
import { SmartCardsView } from './smart-cards-view';
import { UsersView } from './users-view';
import { ErrorState, LoadingState } from './ui';

type Tab = 'overview' | 'branches' | 'users' | 'roles' | 'smartCards' | 'audit' | 'settings';

const navigation = [
  { id: 'overview' as const, label: 'التشغيل اليومي', icon: LayoutDashboard, permission: 'dashboard.view' },
  { id: 'branches' as const, label: 'الفروع والخزائن', icon: Building2, permission: 'branches.view' },
  { id: 'users' as const, label: 'المستخدمون', icon: Users, permission: 'users.view' },
  { id: 'roles' as const, label: 'الأدوار والصلاحيات', icon: KeyRound, permission: 'roles.view' },
  { id: 'smartCards' as const, label: 'الكروت الذكية', icon: CreditCard, permission: 'smart_cards.view' },
  { id: 'audit' as const, label: 'سجل المراجعة', icon: ScrollText, permission: 'audit.view' },
  { id: 'settings' as const, label: 'إعدادات المؤسسة', icon: Settings, permission: 'settings.view' },
];

const defaultBranding: OrganizationSettings = {
  name: 'EduCore Learning Center',
  systemName: 'EduCore ERP',
  cardSubtitle: 'منصة إدارة مركز تعليمي',
  cardBackTitle: null,
  cardBackInstruction: null,
  cardBackFooter: null,
  logoUrl: '/api/branding/logo',
  hasCustomLogo: false,
};

export function WorkspaceShell() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [branding, setBranding] = useState<OrganizationSettings>(defaultBranding);
  const [tab, setTab] = useState<Tab>('overview');
  const [navOpen, setNavOpen] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    Promise.all([
      request<SessionUser>('/auth/me'),
      request<OrganizationSettings>('/workspace/settings').catch(() => defaultBranding),
    ])
      .then(([session, settings]) => {
        setUser(session);
        setBranding(settings);
        document.title = settings.systemName;
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'تعذر التحقق من الجلسة');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      });
  }, [version]);

  const allowedNavigation = useMemo(
    () => navigation.filter((item) => user?.permissions.includes(item.permission)),
    [user],
  );

  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.replace('/');
    }
  }

  if (error) return <main className="fatal-state"><ErrorState message={error} retry={() => setVersion((value) => value + 1)} /><button className="primary-action" onClick={() => router.replace('/')}>العودة لتسجيل الدخول</button></main>;
  if (!user) return <main className="fatal-state"><LoadingState /></main>;

  const can = (permission: string) => user.permissions.includes(permission);

  return (
    <div className="workspace-shell">
      <aside className={`navigation-rail ${navOpen ? 'is-open' : ''}`}>
        <header className="rail-head">
          <div className="rail-brand-lockup"><img src={branding.logoUrl} alt="لوجو المؤسسة" /><div><span>{branding.systemName}</span><strong>{branding.name}</strong></div></div>
          <button className="icon-button mobile-only" onClick={() => setNavOpen(false)}><X size={19} /></button>
        </header>
        <nav>
          {allowedNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={tab === item.id ? 'active' : ''}
                onClick={() => { setTab(item.id); setNavOpen(false); }}
              >
                <Icon size={18} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <footer className="rail-footer">
          <span>{user.role}</span>
          <strong>{user.name}</strong>
          <small>{user.branches.map((branch) => branch.code).join(' · ')}</small>
        </footer>
      </aside>

      {navOpen ? <button className="nav-scrim" aria-label="إغلاق القائمة" onClick={() => setNavOpen(false)} /> : null}

      <main className="workspace-main">
        <header className="workspace-topbar">
          <button className="icon-button mobile-only" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
          <label className="command-input"><Command size={18} /><input placeholder="ابحث عن طالب، ولي أمر، إيصال، فرع أو أمر..." /></label>
          <div className="topbar-user"><span>{user.name}</span><small>{user.email}</small></div>
          <button className="logout-button" onClick={() => void logout()}><LogOut size={17} /><span>خروج</span></button>
        </header>
        <section className="workspace-content">
          {tab === 'overview' ? <OverviewView /> : null}
          {tab === 'branches' ? <BranchesView canManage={can('branches.manage')} /> : null}
          {tab === 'users' ? <UsersView canManage={can('users.manage')} /> : null}
          {tab === 'roles' ? <RolesView canManage={can('roles.manage')} /> : null}
          {tab === 'smartCards' ? <SmartCardsView permissions={user.permissions} /> : null}
          {tab === 'audit' ? <AuditView /> : null}
          {tab === 'settings' ? <SettingsView canManage={can('settings.manage')} onUpdated={setBranding} /> : null}
        </section>
      </main>
    </div>
  );
}
