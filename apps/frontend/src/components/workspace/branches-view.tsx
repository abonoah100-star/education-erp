'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Power, Vault } from 'lucide-react';
import { request } from '@/lib/api';
import type { BranchRow, ListResult } from '@/lib/models';
import { EmptyState, ErrorState, LoadingState, Modal, SectionHeader, StatusPill } from './ui';

export function BranchesView({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState<'branch' | 'cashbox' | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    request<ListResult<BranchRow>>('/workspace/branches')
      .then((result) => setRows(result.items))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل الفروع'))
      .finally(() => setLoading(false));
  }, [version]);

  const totals = useMemo(() => ({
    branches: rows.length,
    active: rows.filter((row) => row.isActive).length,
    cashboxes: rows.reduce((sum, row) => sum + row.cashboxes.length, 0),
  }), [rows]);

  async function createBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/workspace/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: String(form.get('code') ?? '').toUpperCase(),
          address: form.get('address') || undefined,
          phone: form.get('phone') || undefined,
        }),
      });
      setModal(null);
      setVersion((value) => value + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر إنشاء الفرع');
    } finally {
      setSaving(false);
    }
  }

  async function createCashbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBranch) return;
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      await request(`/workspace/branches/${selectedBranch.id}/cashboxes`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: String(form.get('code') ?? '').toUpperCase(),
        }),
      });
      setModal(null);
      setSelectedBranch(null);
      setVersion((value) => value + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر إنشاء الخزينة');
    } finally {
      setSaving(false);
    }
  }

  async function toggleBranch(row: BranchRow) {
    await request(`/workspace/branches/${row.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    setVersion((value) => value + 1);
  }

  return (
    <>
      <SectionHeader
        eyebrow="الهيكل التشغيلي"
        title="الفروع والخزائن"
        description="إدارة نطاق كل فرع وخزائنه ومستخدميه دون خلط البيانات بين الفروع."
        action={canManage ? (
          <button className="primary-action" onClick={() => setModal('branch')}>
            <Plus size={18} /> إضافة فرع
          </button>
        ) : undefined}
      />

      <div className="summary-line">
        <span><Building2 size={17} /> {totals.branches} فروع</span>
        <span>{totals.active} نشطة</span>
        <span><Vault size={17} /> {totals.cashboxes} خزائن</span>
      </div>

      {loading ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => setVersion((value) => value + 1)} />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد فروع" description="أضف أول فرع لبدء توزيع التشغيل والحسابات." />
      ) : (
        <section className="data-surface branch-directory">
          {rows.map((branch) => (
            <article className="branch-record" key={branch.id}>
              <header>
                <div className="branch-identity">
                  <span className="branch-code">{branch.code}</span>
                  <div>
                    <h2>{branch.name}</h2>
                    <p>{branch.address || 'لم يتم تسجيل عنوان'} {branch.phone ? `· ${branch.phone}` : ''}</p>
                  </div>
                </div>
                <div className="record-actions">
                  <StatusPill active={branch.isActive} />
                  {canManage ? (
                    <>
                      <button
                        className="secondary-action"
                        onClick={() => { setSelectedBranch(branch); setModal('cashbox'); }}
                      >
                        <Plus size={16} /> خزينة
                      </button>
                      <button className="icon-button" onClick={() => void toggleBranch(branch)} title="تغيير الحالة">
                        <Power size={17} />
                      </button>
                    </>
                  ) : null}
                </div>
              </header>
              <div className="branch-meta">
                <span>{branch.usersCount} مستخدمين مرتبطين</span>
                <span>{branch.cashboxes.length} خزائن</span>
              </div>
              <div className="cashbox-lines">
                {branch.cashboxes.map((cashbox) => (
                  <div key={cashbox.id}>
                    <div><strong>{cashbox.name}</strong><span>{cashbox.code}</span></div>
                    <strong>{cashbox.balance.toLocaleString('ar-EG')} ج</strong>
                    <StatusPill active={cashbox.status === 'ACTIVE'} activeText="مفتوحة" inactiveText="مغلقة" />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {modal === 'branch' ? (
        <Modal title="إضافة فرع جديد" onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={createBranch}>
            <label className="field"><span>اسم الفرع</span><input name="name" required maxLength={120} /></label>
            <label className="field"><span>كود الفرع</span><input name="code" required pattern="[A-Za-z0-9_-]{2,20}" /></label>
            <label className="field full"><span>العنوان</span><input name="address" maxLength={250} /></label>
            <label className="field full"><span>الهاتف</span><input name="phone" maxLength={30} /></label>
            {formError ? <p className="form-error full">{formError}</p> : null}
            <div className="form-actions full">
              <button type="button" className="secondary-action" onClick={() => setModal(null)}>إلغاء</button>
              <button className="primary-action" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الفرع'}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {modal === 'cashbox' && selectedBranch ? (
        <Modal title={`إضافة خزينة — ${selectedBranch.name}`} onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={createCashbox}>
            <label className="field"><span>اسم الخزينة</span><input name="name" required maxLength={120} /></label>
            <label className="field"><span>كود الخزينة</span><input name="code" required pattern="[A-Za-z0-9_-]{2,30}" /></label>
            {formError ? <p className="form-error full">{formError}</p> : null}
            <div className="form-actions full">
              <button type="button" className="secondary-action" onClick={() => setModal(null)}>إلغاء</button>
              <button className="primary-action" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'إنشاء الخزينة'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
