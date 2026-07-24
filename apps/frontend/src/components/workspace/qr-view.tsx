'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Copy, Plus, QrCode, RefreshCw, ShieldOff } from 'lucide-react';
import { request } from '@/lib/api';
import type { IssuedQrCard, ListResult, QrCardRow } from '@/lib/models';
import { EmptyState, ErrorState, LoadingState, Modal, SectionHeader, StatusPill } from './ui';

const typeLabels = { STUDENT: 'طالب', GUARDIAN: 'ولي أمر', STAFF: 'موظف' } as const;

export function QrView({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<QrCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [showIssue, setShowIssue] = useState(false);
  const [issued, setIssued] = useState<IssuedQrCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    request<ListResult<QrCardRow>>('/workspace/qr-cards')
      .then((result) => setRows(result.items))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل البطاقات'))
      .finally(() => setLoading(false));
  }, [version]);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await request<IssuedQrCard>('/workspace/qr-cards', {
        method: 'POST',
        body: JSON.stringify({
          cardType: form.get('cardType'),
          subjectId: form.get('subjectId'),
          expiresAt: form.get('expiresAt') || undefined,
        }),
      });
      setShowIssue(false);
      setIssued(result);
      setVersion((value) => value + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر إصدار البطاقة');
    } finally {
      setSaving(false);
    }
  }

  async function revoke(card: QrCardRow) {
    await request(`/workspace/qr-cards/${card.id}/revoke`, { method: 'POST' });
    setVersion((value) => value + 1);
  }

  async function replace(card: QrCardRow) {
    const result = await request<IssuedQrCard>(`/workspace/qr-cards/${card.id}/replace`, { method: 'POST' });
    setIssued(result);
    setVersion((value) => value + 1);
  }

  return (
    <>
      <SectionHeader
        eyebrow="الهوية الذكية"
        title="بطاقات QR"
        description="الرمز السري لا يظهر في القوائم؛ payload الإصدار يظهر مرة واحدة فقط عند الإنشاء أو الاستبدال."
        action={canManage ? (
          <button className="primary-action" onClick={() => setShowIssue(true)}>
            <Plus size={18} /> إصدار بطاقة
          </button>
        ) : undefined}
      />

      <div className="security-notice">
        <QrCode size={20} />
        <div><strong>لا يتم إرجاع secretHash من الـAPI.</strong><span>تظهر فقط البيانات العامة اللازمة للإدارة.</span></div>
      </div>

      {loading ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => setVersion((value) => value + 1)} />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد بطاقات" description="أصدر أول بطاقة لطالب أو ولي أمر أو موظف." />
      ) : (
        <section className="data-surface table-surface">
          <div className="table-row table-head qr-grid">
            <span>الكود</span><span>النوع</span><span>صاحب البطاقة</span><span>الحالة</span><span>الإجراءات</span>
          </div>
          {rows.map((row) => (
            <article className="table-row qr-grid" key={row.id}>
              <div className="line-primary"><strong>{row.publicCode}</strong><span>{new Date(row.createdAt).toLocaleDateString('ar-EG')}</span></div>
              <span>{typeLabels[row.cardType]}</span>
              <span>{row.subjectId}</span>
              <StatusPill active={row.isActive} activeText="فعالة" inactiveText="ملغاة" />
              <div className="inline-actions">
                {canManage && row.isActive ? (
                  <>
                    <button className="icon-button" title="استبدال" onClick={() => void replace(row)}><RefreshCw size={16} /></button>
                    <button className="icon-button danger" title="إلغاء" onClick={() => void revoke(row)}><ShieldOff size={16} /></button>
                  </>
                ) : <span className="muted-copy">—</span>}
              </div>
            </article>
          ))}
        </section>
      )}

      {showIssue ? (
        <Modal title="إصدار بطاقة QR" onClose={() => setShowIssue(false)}>
          <form className="form-grid" onSubmit={issue}>
            <label className="field"><span>نوع البطاقة</span><select name="cardType" defaultValue="STUDENT"><option value="STUDENT">طالب</option><option value="GUARDIAN">ولي أمر</option><option value="STAFF">موظف</option></select></label>
            <label className="field"><span>كود صاحب البطاقة</span><input name="subjectId" required maxLength={80} placeholder="STU-0001" /></label>
            <label className="field full"><span>تاريخ الانتهاء — اختياري</span><input name="expiresAt" type="datetime-local" /></label>
            {formError ? <p className="form-error full">{formError}</p> : null}
            <div className="form-actions full"><button type="button" className="secondary-action" onClick={() => setShowIssue(false)}>إلغاء</button><button className="primary-action" disabled={saving}>{saving ? 'جارٍ الإصدار...' : 'إصدار البطاقة'}</button></div>
          </form>
        </Modal>
      ) : null}

      {issued ? (
        <Modal title="احفظ بيانات البطاقة الآن" onClose={() => setIssued(null)}>
          <div className="one-time-secret">
            <p>هذا الـpayload يظهر مرة واحدة. استخدمه لاحقًا لتوليد صورة QR أو طباعتها.</p>
            <code>{issued.qrPayload}</code>
            <button className="primary-action" onClick={() => void navigator.clipboard.writeText(issued.qrPayload)}><Copy size={17} /> نسخ payload</button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
