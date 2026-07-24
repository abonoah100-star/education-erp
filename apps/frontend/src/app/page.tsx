'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { request } from '@/lib/api';
import type { OrganizationSettings } from '@/lib/models';

const fallbackBranding: OrganizationSettings = {
  name: 'EduCore Learning Center',
  systemName: 'EduCore ERP',
  cardSubtitle: 'منصة إدارة مركز تعليمي',
  cardBackTitle: null,
  cardBackInstruction: null,
  cardBackFooter: null,
  logoUrl: '/api/branding/logo',
  hasCustomLogo: false,
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@edu.local');
  const [password, setPassword] = useState('Admin@123');
  const [branding, setBranding] = useState<OrganizationSettings>(fallbackBranding);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('accessToken')) router.replace('/workspace');
    request<OrganizationSettings>('/branding')
      .then((settings) => {
        setBranding(settings);
        document.title = settings.systemName;
      })
      .catch(() => undefined);
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await request<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      router.push('/workspace');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <section className="login-visual">
        <div>
          <div className="login-brand-lockup"><img src={branding.logoUrl} alt="لوجو المؤسسة" /><div className="brand">{branding.systemName}</div></div>
          <h1>{branding.name}<br />مساحة تشغيل مصممة للإدارة الفعلية.</h1>
          <p>{branding.cardSubtitle || 'فروع، خزائن، صلاحيات ومتابعة تشغيلية في نظام واحد قابل للتوسع.'}</p>
        </div>
        <small>Sprint 2A.1 · Modular Monolith</small>
      </section>
      <section className="login-form">
        <form className="form-box" onSubmit={submit}>
          <p className="muted">تسجيل الدخول إلى {branding.systemName}</p>
          <h2>مرحبًا بعودتك</h2>
          <label className="field">البريد الإلكتروني<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label>
          <label className="field">كلمة المرور<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required /></label>
          <button className="primary" disabled={loading}>{loading ? 'جارٍ الدخول...' : 'دخول النظام'}</button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
