'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function StatusPill({
  active,
  activeText = 'نشط',
  inactiveText = 'موقوف',
}: {
  active: boolean;
  activeText?: string;
  inactiveText?: string;
}) {
  return <span className={`status-pill ${active ? 'is-active' : 'is-inactive'}`}>{active ? activeText : inactiveText}</span>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </header>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

export function LoadingState() {
  return <div className="state-line"><span className="loading-dot" /> جارٍ تحميل البيانات...</div>;
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="state-line is-error">
      <span>{message}</span>
      <button className="text-button" onClick={retry}>إعادة المحاولة</button>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
