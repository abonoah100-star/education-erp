'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Shield } from 'lucide-react';
import { request } from '@/lib/api';
import type { ListResult, PermissionRow, RoleRow } from '@/lib/models';
import { EmptyState, ErrorState, LoadingState, Modal, SectionHeader } from './ui';

export function RolesView({ canManage }: { canManage: boolean }) {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
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
      request<ListResult<RoleRow>>('/access/roles'),
      request<ListResult<PermissionRow>>('/access/permissions'),
    ])
      .then(([rolesResult, permissionsResult]) => {
        setRoles(rolesResult.items);
        setPermissions(permissionsResult.items);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل الأدوار'))
      .finally(() => setLoading(false));
  }, [version]);

  const modules = useMemo(() => {
    const grouped = new Map<string, PermissionRow[]>();
    for (const permission of permissions) {
      grouped.set(permission.module, [...(grouped.get(permission.module) ?? []), permission]);
    }
    return [...grouped.entries()];
  }, [permissions]);

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/access/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: String(form.get('code') ?? '').toUpperCase(),
          permissionIds: form.getAll('permissionIds'),
        }),
      });
      setShowCreate(false);
      setVersion((value) => value + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر إنشاء الدور');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionHeader
        eyebrow="مصفوفة الوصول"
        title="الأدوار والصلاحيات"
        description="كل صلاحية مستقلة وتُفحص داخل الـBackend قبل تنفيذ الطلب."
        action={canManage ? (
          <button className="primary-action" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> دور مخصص
          </button>
        ) : undefined}
      />

      <div className="summary-line">
        <span><Shield size={17} /> {roles.length} أدوار</span>
        <span><KeyRound size={17} /> {permissions.length} صلاحيات دقيقة</span>
      </div>

      {loading ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => setVersion((value) => value + 1)} />
      ) : roles.length === 0 ? (
        <EmptyState title="لا توجد أدوار" description="أنشئ دورًا مخصصًا وحدد صلاحياته." />
      ) : (
        <section className="role-directory">
          {roles.map((role) => (
            <article className="role-record" key={role.id}>
              <header>
                <div>
                  <span className="eyebrow">{role.isSystem ? 'دور نظامي' : 'دور مخصص'}</span>
                  <h2>{role.name}</h2>
                  <p>{role.code} · {role.usersCount} مستخدمين</p>
                </div>
                <span className="quiet-label">{role.permissions.length} صلاحيات</span>
              </header>
              <div className="permission-lines">
                {role.permissions.map((permission) => (
                  <span key={permission.id} title={permission.code}>{permission.name}</span>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {showCreate ? (
        <Modal title="إنشاء دور مخصص" onClose={() => setShowCreate(false)}>
          <form className="form-grid" onSubmit={createRole}>
            <label className="field"><span>اسم الدور</span><input name="name" required maxLength={100} /></label>
            <label className="field"><span>الكود</span><input name="code" required pattern="[A-Za-z0-9_]{2,40}" /></label>
            <div className="permission-picker full">
              {modules.map(([module, modulePermissions]) => (
                <fieldset className="choice-field" key={module}>
                  <legend>{module}</legend>
                  <div className="choice-grid">
                    {modulePermissions.map((permission) => (
                      <label key={permission.id}>
                        <input type="checkbox" name="permissionIds" value={permission.id} /> {permission.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            {formError ? <p className="form-error full">{formError}</p> : null}
            <div className="form-actions full">
              <button type="button" className="secondary-action" onClick={() => setShowCreate(false)}>إلغاء</button>
              <button className="primary-action" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الدور'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
