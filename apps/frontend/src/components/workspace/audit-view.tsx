'use client';

import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { request } from '@/lib/api';
import type { AuditRow, ListResult } from '@/lib/models';
import { EmptyState, ErrorState, LoadingState, SectionHeader } from './ui';

export function AuditView() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setLoading(true);
    request<ListResult<AuditRow>>('/access/audit-logs')
      .then((result) => setRows(result.items))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل السجل'))
      .finally(() => setLoading(false));
  }, [version]);

  return (
    <>
      <SectionHeader eyebrow="الحوكمة" title="سجل المراجعة" description="تتبع العمليات الحساسة ومن نفذها ووقت التنفيذ." />
      <div className="summary-line"><span><ScrollText size={17} /> آخر {rows.length} عملية</span></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => setVersion((value) => value + 1)} /> : rows.length === 0 ? <EmptyState title="السجل فارغ" description="ستظهر هنا عمليات الدخول والتعديلات الإدارية." /> : (
        <section className="data-surface table-surface">
          <div className="table-row table-head audit-grid"><span>العملية</span><span>المنفذ</span><span>العنصر</span><span>الوقت</span></div>
          {rows.map((row) => <article className="table-row audit-grid" key={row.id}><div className="line-primary"><strong>{row.action}</strong><span>{row.ipAddress || 'IP غير مسجل'}</span></div><span>{row.actor?.name ?? row.actorName ?? 'النظام'}</span><span>{row.entityType}{row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}</span><time>{new Date(row.createdAt).toLocaleString('ar-EG')}</time></article>)}
        </section>
      )}
    </>
  );
}
