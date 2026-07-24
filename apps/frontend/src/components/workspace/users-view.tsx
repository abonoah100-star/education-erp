'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, UserRoundCog } from 'lucide-react';
import { request } from '@/lib/api';
import type { BranchRow, ListResult, RoleRow, UserRow } from '@/lib/models';
import { EmptyState, ErrorState, LoadingState, Modal, SectionHeader, StatusPill } from './ui';

export function UsersView({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      request<ListResult<UserRow>>('/access/users'),
      request<ListResult<RoleRow>>('/access/roles'),
      request<ListResult<BranchRow>>('/workspace/branches'),
    ])
      .then(([usersResult, rolesResult, branchesResult]) => {
        setRows(usersResult.items);
        setRoles(rolesResult.items);
        setBranches(branchesResult.items);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل المستخدمين'))
      .finally(() => setLoading(false));
  }, [version]);

  const activeCount = useMemo(() => rows.filter((row) => row.status === 'ACTIVE').length, [rows]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/access/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          roleIds: form.getAll('roleIds'),
          branchIds: form.getAll('branchIds'),
        }),
      });
      setShowCreate(false);
      setVersion((value) => value + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر إنشاء المستخدم');
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(row: UserRow) {
    await request(`/access/users/${row.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }),
    });
    setVersion((value) => value + 1);
  }

  return (
    <>
      <SectionHeader
        eyebrow="التحكم في الوصول"
        title="المستخدمون"
        description="حسابات الموظفين والمديرين مع ربط واضح بالأدوار والفروع المسموح بها."
        action={canManage ? (
          <button className="primary-action" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> مستخدم جديد
          </button>
        ) : undefined}
      />

      <div className="summary-line">
        <span><UserRoundCog size={17} /> {rows.length} حسابات</span>
        <span>{activeCount} نشطة</span>
        <span><ShieldCheck size={17} /> صلاحيات من الـBackend</span>
      </div>

      {loading ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => setVersion((value) => value + 1)} />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد حسابات" description="أنشئ أول مستخدم واربطه بالدور والفروع المناسبة." />
      ) : (
        <section className="data-surface table-surface">
          <div className="table-row table-head users-grid">
            <span>المستخدم</span><span>الدور</span><span>الفروع</span><span>الحالة</span><span>إجراء</span>
          </div>
          {rows.map((row) => (
            <article className="table-row users-grid" key={row.id}>
              <div className="line-primary">
                <strong>{row.name}</strong>
                <span>{row.email}</span>
              </div>
              <div className="tag-cluster">{row.roles.map((role) => <span key={role.id}>{role.name}</span>)}</div>
              <div className="tag-cluster">{row.branches.map((branch) => <span key={branch.id}>{branch.code}</span>)}</div>
              <StatusPill active={row.status === 'ACTIVE'} />
              <div>
                {canManage ? (
                  <button className="text-button" onClick={() => void toggleUser(row)}>
                    {row.status === 'ACTIVE' ? 'إيقاف' : 'إعادة تفعيل'}
                  </button>
                ) : <span className="muted-copy">عرض فقط</span>}
              </div>
            </article>
          ))}
        </section>
      )}

      {showCreate ? (
        <Modal title="إنشاء حساب مستخدم" onClose={() => setShowCreate(false)}>
          <form className="form-grid" onSubmit={createUser}>
            <label className="field"><span>الاسم</span><input name="name" required maxLength={120} /></label>
            <label className="field"><span>البريد الإلكتروني</span><input name="email" type="email" required /></label>
            <label className="field full"><span>كلمة المرور المؤقتة</span><input name="password" type="password" minLength={10} required /></label>
            <fieldset className="choice-field full">
              <legend>الأدوار</legend>
              <div className="choice-grid">
                {roles.map((role) => (
                  <label key={role.id}><input type="checkbox" name="roleIds" value={role.id} /> {role.name}</label>
                ))}
              </div>
            </fieldset>
            <fieldset className="choice-field full">
              <legend>الفروع المسموحة</legend>
              <div className="choice-grid">
                {branches.map((branch) => (
                  <label key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} /> {branch.name}</label>
                ))}
              </div>
            </fieldset>
            {formError ? <p className="form-error full">{formError}</p> : null}
            <div className="form-actions full">
              <button type="button" className="secondary-action" onClick={() => setShowCreate(false)}>إلغاء</button>
              <button className="primary-action" disabled={saving}>{saving ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
