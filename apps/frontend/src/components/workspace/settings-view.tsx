'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Building2, ImageUp, RotateCcw, Save } from 'lucide-react';
import { request, requestFormData } from '@/lib/api';
import type { OrganizationSettings } from '@/lib/models';
import { ErrorState, LoadingState, SectionHeader } from './ui';

interface Props {
  canManage: boolean;
  onUpdated: (settings: OrganizationSettings) => void;
}

export function SettingsView({ canManage, onUpdated }: Props) {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    request<OrganizationSettings>('/workspace/settings')
      .then(setSettings)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل الإعدادات'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  function changeLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || !canManage) return;
    setSaving(true);
    setError('');
    setSuccess('');
    const form = new FormData(event.currentTarget);
    try {
      let updated = await request<OrganizationSettings>('/workspace/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.get('name'),
          systemName: form.get('systemName'),
          cardSubtitle: form.get('cardSubtitle') || undefined,
          cardBackTitle: form.get('cardBackTitle') || undefined,
          cardBackInstruction: form.get('cardBackInstruction') || undefined,
          cardBackFooter: form.get('cardBackFooter') || undefined,
        }),
      });
      if (logoFile) {
        const upload = new FormData();
        upload.set('file', logoFile);
        updated = await requestFormData<OrganizationSettings>('/workspace/settings/logo', upload);
      }
      setSettings(updated);
      setLogoFile(null);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview('');
      onUpdated(updated);
      document.title = updated.systemName;
      setSuccess('تم تحديث اسم المكان وهوية النظام واللوجو والكروت بنجاح.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  }

  async function resetLogo() {
    if (!settings || !canManage || !window.confirm('سيتم الرجوع إلى اللوجو الافتراضي. هل تريد المتابعة؟')) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await request<OrganizationSettings>('/workspace/settings/logo', { method: 'DELETE' });
      setSettings(updated);
      setLogoFile(null);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview('');
      onUpdated(updated);
      setSuccess('تم الرجوع إلى اللوجو الافتراضي بنجاح.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إعادة اللوجو الافتراضي');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!settings) return <ErrorState message={error || 'تعذر تحميل الإعدادات'} retry={() => window.location.reload()} />;

  const displayedLogo = logoPreview || settings.logoUrl;

  return (
    <>
      <SectionHeader
        eyebrow="إعدادات المؤسسة"
        title="هوية المكان والنظام"
        description="مصدر موحد لاسم المكان واسم النظام واللوجو والنص الذي يظهر على الكروت الذكية."
      />
      <section className="settings-workspace">
        <div className="settings-intro">
          <img className="settings-brand-logo" src={displayedLogo} alt="لوجو المؤسسة" />
          <div>
            <Building2 size={24} />
            <strong>{settings.systemName}</strong>
            <span>{settings.name}</span>
            <small>{settings.hasCustomLogo ? 'لوجو مخصص مفعّل' : 'يتم استخدام اللوجو الافتراضي'}</small>
          </div>
        </div>
        <form className="settings-form" onSubmit={submit}>
          <label className="field">
            <span>اسم المكان الرسمي</span>
            <input name="name" defaultValue={settings.name} required minLength={2} maxLength={120} disabled={!canManage} />
            <small>يظهر على الكارت وفي البيانات الرسمية.</small>
          </label>
          <label className="field">
            <span>اسم المشروع أو النظام</span>
            <input name="systemName" defaultValue={settings.systemName} required minLength={2} maxLength={80} disabled={!canManage} />
            <small>يظهر في القائمة الجانبية وشاشة الدخول وعنوان المتصفح.</small>
          </label>
          <label className="field full">
            <span>النص التعريفي على الكارت</span>
            <input name="cardSubtitle" defaultValue={settings.cardSubtitle ?? ''} maxLength={120} disabled={!canManage} placeholder="مثال: منصة إدارة مركز تعليمي" />
          </label>
          <div className="settings-subsection full">
            <strong>نصوص ظهر الكارت</strong>
            <span>تُستخدم في المعاينة والصور المحفوظة والمشاركة والطباعة، مع نصوص افتراضية عند ترك الحقول فارغة.</span>
          </div>
          <label className="field full">
            <span>العنوان الرئيسي على ظهر الكارت</span>
            <textarea name="cardBackTitle" defaultValue={settings.cardBackTitle ?? ''} maxLength={180} rows={2} disabled={!canManage} placeholder="مثال: هذه البطاقة ملك مركز المستقبل" />
          </label>
          <label className="field full">
            <span>تعليمات العثور على الكارت</span>
            <textarea name="cardBackInstruction" defaultValue={settings.cardBackInstruction ?? ''} maxLength={240} rows={3} disabled={!canManage} placeholder="مثال: عند العثور عليها يرجى تسليمها إلى أقرب فرع" />
          </label>
          <label className="field full">
            <span>نص سفلي اختياري</span>
            <textarea name="cardBackFooter" defaultValue={settings.cardBackFooter ?? ''} maxLength={180} rows={2} disabled={!canManage} placeholder="مثال: يرجى المحافظة على البطاقة وعدم مشاركتها مع الغير" />
          </label>
          <div className="field full organization-logo-field">
            <span>لوجو المؤسسة</span>
            <div className="organization-logo-picker">
              <img src={displayedLogo} alt="معاينة اللوجو" />
              <div>
                <label className={`secondary-action ${canManage ? '' : 'disabled'}`}>
                  <ImageUp size={17} /> اختيار لوجو
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={changeLogo} disabled={!canManage} />
                </label>
                <small>JPG أو PNG أو WebP — يفضّل ملف مربع بخلفية شفافة. يعاد ضبطه تلقائيًا لجودة الموقع والكارت.</small>
                {canManage && settings.hasCustomLogo ? <button type="button" className="text-button danger-text" onClick={() => void resetLogo()} disabled={saving}><RotateCcw size={16} /> استخدام اللوجو الافتراضي</button> : null}
              </div>
            </div>
          </div>
          {error ? <p className="form-error full">{error}</p> : null}
          {success ? <p className="form-success full">{success}</p> : null}
          {canManage ? <div className="form-actions full"><button className="primary-action" disabled={saving}><Save size={17} />{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button></div> : null}
        </form>
      </section>
    </>
  );
}
