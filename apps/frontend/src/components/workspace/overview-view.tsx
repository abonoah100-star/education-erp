'use client';

import { useEffect, useState } from 'react';
import { Activity, Building2, CircleDollarSign, Users } from 'lucide-react';
import { request } from '@/lib/api';
import type { OverviewData } from '@/lib/models';
import { ErrorState, LoadingState, SectionHeader, StatusPill } from './ui';

export function OverviewView() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setError('');
    request<OverviewData>('/workspace/overview')
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل البيانات'));
  }, [version]);

  if (error) return <ErrorState message={error} retry={() => setVersion((value) => value + 1)} />;
  if (!data) return <LoadingState />;

  return (
    <>
      <SectionHeader
        eyebrow="مساحة التشغيل"
        title="نظرة تشغيلية موحدة"
        description="ملخص حي للفروع والخزائن والمستخدمين مع أهم التنبيهات الإدارية."
      />

      <section className="pulse-strip">
        <div className="pulse-lead">
          <Activity size={22} />
          <div>
            <span>حالة المنصة</span>
            <strong>الخدمات الأساسية تعمل بصورة طبيعية</strong>
          </div>
        </div>
        <div className="pulse-metric">
          <Building2 size={20} />
          <span>الفروع النشطة</span>
          <strong>{data.branches}</strong>
        </div>
        <div className="pulse-metric">
          <CircleDollarSign size={20} />
          <span>إجمالي أرصدة الخزائن</span>
          <strong>{data.totalCashBalance.toLocaleString('ar-EG')} ج</strong>
        </div>
        <div className="pulse-metric">
          <Users size={20} />
          <span>المستخدمون النشطون</span>
          <strong>{data.users}</strong>
        </div>
      </section>

      <div className="split-workspace">
        <section className="data-surface">
          <header className="surface-head">
            <div>
              <span className="eyebrow">الوضع المالي التشغيلي</span>
              <h2>الخزائن حسب الفرع</h2>
            </div>
            <span className="quiet-label">محدّث الآن</span>
          </header>
          <div className="data-list">
            {data.cashboxes.map((cashbox) => (
              <article className="data-line" key={cashbox.id}>
                <div className="line-primary">
                  <strong>{cashbox.branch?.name}</strong>
                  <span>{cashbox.name} · {cashbox.code}</span>
                </div>
                <strong className="money-value">{cashbox.balance.toLocaleString('ar-EG')} ج</strong>
                <StatusPill
                  active={cashbox.status === 'ACTIVE'}
                  activeText="مفتوحة"
                  inactiveText="مغلقة"
                />
              </article>
            ))}
          </div>
        </section>

        <aside className="attention-surface">
          <header className="surface-head compact">
            <div>
              <span className="eyebrow">مركز الانتباه</span>
              <h2>ما يحتاج متابعة</h2>
            </div>
          </header>
          {data.attention.map((item) => (
            <article className="attention-line" key={item.title}>
              <span className={`attention-mark ${item.level}`} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </aside>
      </div>

      <section className="data-surface activity-surface">
        <header className="surface-head">
          <div>
            <span className="eyebrow">سجل المراجعة</span>
            <h2>آخر النشاطات</h2>
          </div>
        </header>
        <div className="activity-timeline">
          {data.recentActivity.length ? data.recentActivity.map((entry) => (
            <article key={entry.id}>
              <span className="timeline-dot" />
              <div>
                <strong>{entry.action}</strong>
                <span>{entry.actorName ?? 'النظام'} · {entry.entityType}</span>
              </div>
              <time>{new Date(entry.createdAt).toLocaleString('ar-EG')}</time>
            </article>
          )) : <p className="muted-copy">لا توجد نشاطات مسجلة بعد.</p>}
        </div>
      </section>
    </>
  );
}
