'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Barcode,
  Boxes,
  Check,
  Download,
  Eye,
  Image as ImageIcon,
  Layers3,
  Link2,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Share2,
  ShieldOff,
} from 'lucide-react';
import { downloadBlob, request, requestBlob, requestFormData } from '@/lib/api';
import type {
  BranchRow,
  CardBatchRow,
  CardPrintJobRow,
  CardPrintLayout,
  CardPrintSide,
  CardTemplateRow,
  ListResult,
  SmartCardRow,
  SmartCardStatus,
  SmartCardType,
} from '@/lib/models';
import { EmptyState, ErrorState, LoadingState, Modal, SectionHeader, StatusPill } from './ui';

type ViewMode = 'cards' | 'templates' | 'inventory' | 'print';
type IssueMode = 'new' | 'assign';

const cardTypeLabels: Record<SmartCardType, string> = {
  STUDENT: 'طالب',
  GUARDIAN: 'ولي أمر',
  TEACHER: 'مدرس',
  STAFF: 'موظف',
};

const statusLabels: Record<SmartCardStatus, string> = {
  DRAFT: 'مسودة',
  IN_STOCK: 'بالمخزون',
  ASSIGNED: 'مرتبط',
  ACTIVE: 'فعال',
  SUSPENDED: 'موقوف',
  LOST: 'مفقود',
  DAMAGED: 'تالف',
  REPLACED: 'مستبدل',
  EXPIRED: 'منتهي',
  REVOKED: 'ملغي',
};

interface Props {
  permissions: string[];
}

export function SmartCardsView({ permissions }: Props) {
  const [mode, setMode] = useState<ViewMode>('cards');
  const [cards, setCards] = useState<SmartCardRow[]>([]);
  const [templates, setTemplates] = useState<CardTemplateRow[]>([]);
  const [batches, setBatches] = useState<CardBatchRow[]>([]);
  const [printJobs, setPrintJobs] = useState<CardPrintJobRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewCard, setPreviewCard] = useState<SmartCardRow | null>(null);
  const [issueMode, setIssueMode] = useState<IssueMode | null>(null);
  const [inventoryCard, setInventoryCard] = useState<SmartCardRow | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [version, setVersion] = useState(0);

  const can = (permission: string) => permissions.includes(permission);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      request<ListResult<SmartCardRow>>('/smart-cards'),
      request<ListResult<CardTemplateRow>>('/smart-cards/templates'),
      request<ListResult<CardBatchRow>>('/smart-cards/inventory-batches'),
      request<ListResult<CardPrintJobRow>>('/smart-cards/print-jobs'),
      request<ListResult<BranchRow>>('/workspace/branches'),
    ])
      .then(([cardResult, templateResult, batchResult, printResult, branchResult]) => {
        setCards(cardResult.items);
        setTemplates(templateResult.items);
        setBatches(batchResult.items);
        setPrintJobs(printResult.items);
        setBranches(branchResult.items);
        setSelectedIds((current) => new Set([...current].filter((id) => cardResult.items.some((card) => card.id === id))));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل وحدة الكروت الذكية'))
      .finally(() => setLoading(false));
  }, [version]);

  const activeTemplates = useMemo(() => templates.filter((template) => template.isActive), [templates]);
  const stockCards = useMemo(() => cards.filter((card) => card.status === 'IN_STOCK'), [cards]);

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      let portraitAssetId: string | undefined;
      const photo = form.get('photo');
      if (photo instanceof File && photo.size > 0) {
        const upload = new FormData();
        upload.append('file', photo);
        const portrait = await requestFormData<{ id: string }>('/smart-cards/portrait-assets', upload);
        portraitAssetId = portrait.id;
      }
      const payload = {
        cardType: form.get('cardType'),
        branchId: form.get('branchId'),
        templateId: form.get('templateId'),
        ownerName: form.get('ownerName'),
        portraitAssetId,
        codeFormat: form.get('codeFormat'),
        expiresAt: form.get('expiresAt') || undefined,
      };
      const card = issueMode === 'assign' && inventoryCard
        ? await request<SmartCardRow>(`/smart-cards/${inventoryCard.id}/assign`, {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : await request<SmartCardRow>('/smart-cards', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setIssueMode(null);
      setInventoryCard(null);
      setPreviewCard(card);
      setVersion((value) => value + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر حفظ الكارت');
    } finally {
      setSaving(false);
    }
  }

  async function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/smart-cards/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          cardType: form.get('cardType'),
          branchId: form.get('branchId') || undefined,
          description: form.get('description') || undefined,
          backgroundColor: form.get('backgroundColor'),
          accentColor: form.get('accentColor'),
          textColor: form.get('textColor'),
          mutedTextColor: form.get('mutedTextColor'),
          defaultCodeFormat: form.get('defaultCodeFormat'),
          showPhoto: form.get('showPhoto') === 'on',
          showBranch: form.get('showBranch') === 'on',
          showExpiry: form.get('showExpiry') === 'on',
        }),
      });
      setShowTemplate(false);
      setVersion((value) => value + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر إنشاء التصميم');
    } finally {
      setSaving(false);
    }
  }

  async function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/smart-cards/inventory-batches', {
        method: 'POST',
        body: JSON.stringify({
          branchId: form.get('branchId'),
          templateId: form.get('templateId'),
          name: form.get('name'),
          code: form.get('code'),
          prefix: form.get('prefix'),
          startNumber: Number(form.get('startNumber')),
          quantity: Number(form.get('quantity')),
          cardType: form.get('cardType'),
          notes: form.get('notes') || undefined,
        }),
      });
      setShowBatch(false);
      setVersion((value) => value + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر إنشاء دفعة المخزون');
    } finally {
      setSaving(false);
    }
  }

  async function submitPrintJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedIds.size === 0) return;
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      const job = await request<CardPrintJobRow>('/smart-cards/print-jobs', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          cardIds: [...selectedIds],
          layout: form.get('layout') as CardPrintLayout,
          sideSelection: form.get('sideSelection') as CardPrintSide,
          templateId: form.get('templateId') || undefined,
        }),
      });
      setShowPrint(false);
      setSelectedIds(new Set());
      setVersion((value) => value + 1);
      await downloadPrintPage(job.id, 1, `${job.name}-page-1.png`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر إنشاء مهمة الطباعة');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(card: SmartCardRow, status: SmartCardStatus) {
    await request(`/smart-cards/${card.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setVersion((value) => value + 1);
  }

  async function replaceCard(card: SmartCardRow) {
    const replacement = await request<SmartCardRow>(`/smart-cards/${card.id}/replace`, { method: 'POST' });
    setPreviewCard(replacement);
    setVersion((value) => value + 1);
  }

  async function downloadPrintPage(jobId: string, page: number, filename: string) {
    const blob = await requestBlob(`/smart-cards/print-jobs/${jobId}/pages/${page}/image.png?download=1`);
    downloadBlob(blob, filename);
  }

  async function markPrinted(job: CardPrintJobRow) {
    await request(`/smart-cards/print-jobs/${job.id}/mark-printed`, { method: 'POST' });
    setVersion((value) => value + 1);
  }

  function toggleCard(cardId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  return (
    <>
      <SectionHeader
        eyebrow="Sprint 2A"
        title="إدارة الكروت الذكية"
        description="QR وCode 128 وصورة كاملة للكارت قابلة للمشاركة والطباعة، مع مخزون كروت وطباعة دفعية."
        action={can('smart_cards.issue') ? (
          <button className="primary-action" onClick={() => { setIssueMode('new'); setFormError(''); }}>
            <Plus size={18} /> إصدار كارت
          </button>
        ) : undefined}
      />

      <div className="smart-card-modebar">
        <button className={mode === 'cards' ? 'active' : ''} onClick={() => setMode('cards')}><QrCode size={17} /> الكروت</button>
        <button className={mode === 'templates' ? 'active' : ''} onClick={() => setMode('templates')}><Layers3 size={17} /> التصميمات</button>
        <button className={mode === 'inventory' ? 'active' : ''} onClick={() => setMode('inventory')}><Boxes size={17} /> المخزون</button>
        <button className={mode === 'print' ? 'active' : ''} onClick={() => setMode('print')}><Printer size={17} /> الطباعة الدفعية</button>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => setVersion((value) => value + 1)} /> : null}

      {!loading && !error && mode === 'cards' ? (
        <CardsDirectory
          cards={cards}
          selectedIds={selectedIds}
          canManage={can('smart_cards.manage_status')}
          canReplace={can('smart_cards.replace')}
          canPrint={can('card_print_jobs.create')}
          onToggle={toggleCard}
          onPreview={setPreviewCard}
          onAssign={(card) => { setInventoryCard(card); setIssueMode('assign'); setFormError(''); }}
          onStatus={(card, status) => void changeStatus(card, status)}
          onReplace={(card) => void replaceCard(card)}
          onCreatePrint={() => { setShowPrint(true); setFormError(''); }}
        />
      ) : null}

      {!loading && !error && mode === 'templates' ? (
        <TemplatesDirectory
          templates={templates}
          canManage={can('card_templates.manage')}
          onCreate={() => { setShowTemplate(true); setFormError(''); }}
          onStatus={async (template) => {
            await request(`/smart-cards/templates/${template.id}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ isActive: !template.isActive }),
            });
            setVersion((value) => value + 1);
          }}
        />
      ) : null}

      {!loading && !error && mode === 'inventory' ? (
        <InventoryDirectory
          batches={batches}
          stockCards={stockCards}
          canManage={can('card_inventory.manage')}
          onCreate={() => { setShowBatch(true); setFormError(''); }}
          onAssign={(card) => { setInventoryCard(card); setIssueMode('assign'); setFormError(''); }}
        />
      ) : null}

      {!loading && !error && mode === 'print' ? (
        <PrintDirectory
          jobs={printJobs}
          canMarkPrinted={can('card_print_jobs.mark_printed')}
          canDownload={can('card_print_jobs.download')}
          onDownload={(job, page) => void downloadPrintPage(job.id, page, `${job.name}-page-${page}.png`)}
          onMarkPrinted={(job) => void markPrinted(job)}
        />
      ) : null}

      {issueMode ? (
        <Modal title={issueMode === 'new' ? 'إصدار كارت جديد' : 'ربط كارت مطبوع بصاحب جديد'} onClose={() => { setIssueMode(null); setInventoryCard(null); }}>
          <CardIssueForm
            key={inventoryCard?.id ?? 'new'}
            branches={branches}
            templates={activeTemplates}
            inventoryCard={inventoryCard}
            saving={saving}
            error={formError}
            onSubmit={submitIssue}
            onCancel={() => { setIssueMode(null); setInventoryCard(null); }}
          />
        </Modal>
      ) : null}

      {showTemplate ? (
        <Modal title="إنشاء تصميم كارت" onClose={() => setShowTemplate(false)}>
          <TemplateForm branches={branches} saving={saving} error={formError} onSubmit={submitTemplate} onCancel={() => setShowTemplate(false)} />
        </Modal>
      ) : null}

      {showBatch ? (
        <Modal title="إضافة دفعة كروت مطبوعة مسبقًا" onClose={() => setShowBatch(false)}>
          <BatchForm branches={branches} templates={activeTemplates} saving={saving} error={formError} onSubmit={submitBatch} onCancel={() => setShowBatch(false)} />
        </Modal>
      ) : null}

      {showPrint ? (
        <Modal title={`إنشاء مهمة طباعة — ${selectedIds.size} كارت`} onClose={() => setShowPrint(false)}>
          <PrintForm templates={activeTemplates} saving={saving} error={formError} onSubmit={submitPrintJob} onCancel={() => setShowPrint(false)} />
        </Modal>
      ) : null}

      {previewCard ? <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} /> : null}
    </>
  );
}

function CardsDirectory({
  cards,
  selectedIds,
  canManage,
  canReplace,
  canPrint,
  onToggle,
  onPreview,
  onAssign,
  onStatus,
  onReplace,
  onCreatePrint,
}: {
  cards: SmartCardRow[];
  selectedIds: Set<string>;
  canManage: boolean;
  canReplace: boolean;
  canPrint: boolean;
  onToggle: (id: string) => void;
  onPreview: (card: SmartCardRow) => void;
  onAssign: (card: SmartCardRow) => void;
  onStatus: (card: SmartCardRow, status: SmartCardStatus) => void;
  onReplace: (card: SmartCardRow) => void;
  onCreatePrint: () => void;
}) {
  if (cards.length === 0) return <EmptyState title="لا توجد كروت" description="ابدأ بإصدار كارت أو إضافة دفعة مخزون." />;
  return (
    <section className="data-surface table-surface">
      <div className="card-selection-bar">
        <span>تم تحديد {selectedIds.size} كارت</span>
        {canPrint ? <button className="secondary-action" disabled={selectedIds.size === 0} onClick={onCreatePrint}><Printer size={16} /> طباعة المحدد</button> : null}
      </div>
      <div className="table-row table-head smart-card-grid">
        <span>تحديد</span><span>الكارت</span><span>صاحب الكارت</span><span>الفرع والتصميم</span><span>الحالة</span><span>الإجراءات</span>
      </div>
      {cards.map((card) => (
        <article className="table-row smart-card-grid" key={card.id}>
          <label className="card-check"><input type="checkbox" checked={selectedIds.has(card.id)} onChange={() => onToggle(card.id)} /><span><Check size={14} /></span></label>
          <div className="line-primary"><strong>{card.publicCode}</strong><span>{cardTypeLabels[card.cardType]} · {card.codeFormat.replaceAll('_', ' + ')}</span></div>
          <div className="line-primary"><strong>{card.ownerName ?? 'غير مرتبط'}</strong><span>{card.subjectId ?? 'متاح بالمخزون'}</span></div>
          <div className="line-primary"><strong>{card.branch?.name ?? 'بدون فرع'}</strong><span>{card.template?.name ?? 'بدون تصميم'}</span></div>
          <span className={`status-pill card-status-${card.status.toLowerCase()}`}>{statusLabels[card.status]}</span>
          <div className="inline-actions">
            <button className="icon-button" title="معاينة وصور" onClick={() => onPreview(card)}><Eye size={16} /></button>
            {card.status === 'IN_STOCK' ? <button className="icon-button" title="ربط بصاحب" onClick={() => onAssign(card)}><Link2 size={16} /></button> : null}
            {canReplace && ['ACTIVE', 'LOST', 'DAMAGED'].includes(card.status) ? <button className="icon-button" title="استبدال" onClick={() => onReplace(card)}><RefreshCw size={16} /></button> : null}
            {canManage && card.status === 'ACTIVE' ? <button className="icon-button danger" title="إيقاف" onClick={() => onStatus(card, 'SUSPENDED')}><ShieldOff size={16} /></button> : null}
            {canManage && card.status === 'SUSPENDED' ? <button className="icon-button" title="إعادة تفعيل" onClick={() => onStatus(card, 'ACTIVE')}><Check size={16} /></button> : null}
          </div>
        </article>
      ))}
    </section>
  );
}

function TemplatesDirectory({ templates, canManage, onCreate, onStatus }: { templates: CardTemplateRow[]; canManage: boolean; onCreate: () => void; onStatus: (template: CardTemplateRow) => void }) {
  return (
    <section className="template-workspace">
      <div className="surface-toolbar"><div><strong>{templates.length} تصميم</strong><span>تصميمات مستقلة للطالب وولي الأمر والمدرس والموظف</span></div>{canManage ? <button className="secondary-action" onClick={onCreate}><Plus size={16} /> تصميم جديد</button> : null}</div>
      <div className="template-lines">
        {templates.map((template) => (
          <article className="template-line" key={template.id}>
            <div className="template-swatch" style={{ background: `linear-gradient(135deg, ${template.backgroundColor}, ${template.accentColor})` }}><QrCode size={28} /></div>
            <div className="template-copy"><div><strong>{template.name}</strong>{template.isDefault ? <span className="quiet-label">افتراضي</span> : null}</div><span>{cardTypeLabels[template.cardType]} · CR80 · {template.defaultCodeFormat.replaceAll('_', ' + ')}</span><p>{template.description}</p></div>
            <div className="template-meta"><span>{template.cardsCount} كارت</span><StatusPill active={template.isActive} activeText="فعال" inactiveText="موقوف" /></div>
            {canManage ? <button className="text-button" onClick={() => void onStatus(template)}>{template.isActive ? 'إيقاف' : 'تفعيل'}</button> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function InventoryDirectory({ batches, stockCards, canManage, onCreate, onAssign }: { batches: CardBatchRow[]; stockCards: SmartCardRow[]; canManage: boolean; onCreate: () => void; onAssign: (card: SmartCardRow) => void }) {
  return (
    <div className="split-workspace card-inventory-layout">
      <section className="data-surface">
        <div className="surface-head"><div><h2>دفعات المخزون</h2><span className="muted-copy">كروت مطبوعة مسبقًا ومسلسلة</span></div>{canManage ? <button className="secondary-action" onClick={onCreate}><Plus size={16} /> إضافة دفعة</button> : null}</div>
        {batches.length === 0 ? <EmptyState title="لا توجد دفعات" description="أنشئ دفعة كروت بأرقام متسلسلة." /> : batches.map((batch) => (
          <article className="inventory-batch-line" key={batch.id}><div><strong>{batch.name}</strong><span>{batch.code} · {batch.branch.name} · {batch.template.name}</span></div><div><strong>{batch.availableCount}</strong><span>متاح من {batch.quantity}</span></div><span className="quiet-label">{batch.status}</span></article>
        ))}
      </section>
      <section className="data-surface">
        <div className="surface-head"><div><h2>الكروت المتاحة</h2><span className="muted-copy">اربط أي كارت بطالب أو ولي أمر أو مدرس جديد</span></div><span className="quiet-label">{stockCards.length}</span></div>
        {stockCards.length === 0 ? <EmptyState title="المخزون فارغ" description="لا توجد كروت غير مرتبطة حاليًا." /> : stockCards.slice(0, 30).map((card) => (
          <article className="stock-card-line" key={card.id}><Barcode size={20} /><div><strong>{card.publicCode}</strong><span>{card.batch?.name ?? 'دفعة مستقلة'}</span></div><button className="text-button" onClick={() => onAssign(card)}>ربط الآن</button></article>
        ))}
      </section>
    </div>
  );
}

function PrintDirectory({ jobs, canMarkPrinted, canDownload, onDownload, onMarkPrinted }: { jobs: CardPrintJobRow[]; canMarkPrinted: boolean; canDownload: boolean; onDownload: (job: CardPrintJobRow, page: number) => void; onMarkPrinted: (job: CardPrintJobRow) => void }) {
  if (jobs.length === 0) return <EmptyState title="لا توجد مهام طباعة" description="حدد الكروت من صفحة الكروت ثم أنشئ مهمة طباعة." />;
  return <section className="data-surface">{jobs.map((job) => (
    <article className="print-job-line" key={job.id}><div className="print-job-icon"><Printer size={21} /></div><div><strong>{job.name}</strong><span>{job.cardsCount} كارت · {job.layout} · {job.sideSelection === 'BOTH' ? 'الوجهين' : job.sideSelection === 'BACK' ? 'الخلفي' : 'الأمامي'} · {job.pageCount} صفحة</span></div><StatusPill active={job.status === 'PRINTED'} activeText="تمت الطباعة" inactiveText="جاهز" /><div className="inline-actions">{canDownload ? Array.from({ length: job.pageCount }, (_, index) => <button className="text-button" key={index} onClick={() => onDownload(job, index + 1)}>صفحة {index + 1}</button>) : null}{canMarkPrinted && job.status !== 'PRINTED' ? <button className="secondary-action" onClick={() => onMarkPrinted(job)}>اعتماد الطباعة</button> : null}</div></article>
  ))}</section>;
}

function CardIssueForm({ branches, templates, inventoryCard, saving, error, onSubmit, onCancel }: { branches: BranchRow[]; templates: CardTemplateRow[]; inventoryCard: SmartCardRow | null; saving: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const defaultType = inventoryCard?.cardType ?? 'STUDENT';
  const [photoPreview, setPhotoPreview] = useState('/default-student-avatar.svg');

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoPreview('/default-student-avatar.svg');
      return;
    }
    setPhotoPreview(URL.createObjectURL(file));
  }

  return <form className="form-grid" onSubmit={onSubmit}>
    {inventoryCard ? <div className="security-notice full"><Barcode size={20} /><div><strong>{inventoryCard.publicCode}</strong><span>سيتم ربط هذا الكارت الموجود في المخزون بالشخص الجديد.</span></div></div> : null}
    <label className="field"><span>نوع صاحب الكارت</span><select name="cardType" defaultValue={defaultType}>{Object.entries(cardTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label className="field"><span>الفرع</span><select name="branchId" defaultValue={inventoryCard?.branchId ?? branches[0]?.id} required>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label>
    <label className="field full"><span>التصميم</span><select name="templateId" defaultValue={inventoryCard?.templateId ?? templates[0]?.id} required>{templates.map((template) => <option value={template.id} key={template.id}>{template.name} — {cardTypeLabels[template.cardType]}</option>)}</select></label>
    <label className="field"><span>اسم صاحب الكارت</span><input name="ownerName" required maxLength={120} placeholder="الاسم كما سيظهر على الكارت" /></label>
    <div className="field sequence-preview"><span>الكود داخل النظام</span><strong>سيتم توليده تلقائيًا ومتسلسلًا عند الحفظ</strong><small>لا يمكن تكراره حتى مع إصدار أكثر من كارت في الوقت نفسه.</small></div>
    <label className="field full card-photo-field">
      <span>صورة صاحب الكارت — اختيارية</span>
      <div className="card-photo-picker">
        <img src={photoPreview} alt="معاينة صورة صاحب الكارت" />
        <div><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={changePhoto} /><small>JPG أو PNG أو WebP — بحد أقصى 5 ميجابايت. عند عدم الاختيار تستخدم صورة طالب افتراضية.</small></div>
      </div>
    </label>
    <label className="field"><span>نوع الرمز</span><select name="codeFormat" defaultValue="QR_AND_BARCODE"><option value="QR_AND_BARCODE">QR + Barcode</option><option value="QR">QR فقط</option><option value="BARCODE">Barcode فقط</option></select></label>
    <label className="field"><span>تاريخ الانتهاء — اختياري</span><input name="expiresAt" type="datetime-local" /></label>
    {error ? <p className="form-error full">{error}</p> : null}
    <div className="form-actions full"><button type="button" className="secondary-action" onClick={onCancel}>إلغاء</button><button className="primary-action" disabled={saving}>{saving ? 'جارٍ رفع الصورة وإصدار الكارت...' : inventoryCard ? 'ربط وإظهار التصميم' : 'إصدار وإظهار التصميم'}</button></div>
  </form>;
}

function TemplateForm({ branches, saving, error, onSubmit, onCancel }: { branches: BranchRow[]; saving: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <form className="form-grid" onSubmit={onSubmit}>
    <label className="field"><span>اسم التصميم</span><input name="name" required defaultValue="تصميم جديد" /></label><label className="field"><span>كود التصميم</span><input name="code" required defaultValue={`CUSTOM-${Date.now().toString().slice(-6)}`} /></label>
    <label className="field"><span>نوع الكارت</span><select name="cardType" defaultValue="STUDENT">{Object.entries(cardTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>الفرع — اختياري</span><select name="branchId" defaultValue=""><option value="">كل الفروع</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label>
    <label className="field full"><span>الوصف</span><input name="description" defaultValue="تصميم مخصص للكروت الذكية" /></label>
    <label className="field color-field"><span>لون الخلفية</span><input name="backgroundColor" type="color" defaultValue="#0F4B3B" /></label><label className="field color-field"><span>لون التمييز</span><input name="accentColor" type="color" defaultValue="#D9B56D" /></label><label className="field color-field"><span>لون النص</span><input name="textColor" type="color" defaultValue="#FFFFFF" /></label><label className="field color-field"><span>النص الثانوي</span><input name="mutedTextColor" type="color" defaultValue="#DCEAE5" /></label>
    <label className="field"><span>نوع الرمز الافتراضي</span><select name="defaultCodeFormat" defaultValue="QR_AND_BARCODE"><option value="QR_AND_BARCODE">QR + Barcode</option><option value="QR">QR</option><option value="BARCODE">Barcode</option></select></label>
    <div className="template-options"><label><input type="checkbox" name="showPhoto" defaultChecked /> صورة/أحرف صاحب الكارت</label><label><input type="checkbox" name="showBranch" defaultChecked /> اسم الفرع</label><label><input type="checkbox" name="showExpiry" /> تاريخ الانتهاء</label></div>
    {error ? <p className="form-error full">{error}</p> : null}<div className="form-actions full"><button type="button" className="secondary-action" onClick={onCancel}>إلغاء</button><button className="primary-action" disabled={saving}>{saving ? 'جارٍ الإنشاء...' : 'إنشاء التصميم'}</button></div>
  </form>;
}

function BatchForm({ branches, templates, saving, error, onSubmit, onCancel }: { branches: BranchRow[]; templates: CardTemplateRow[]; saving: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <form className="form-grid" onSubmit={onSubmit}>
    <label className="field"><span>اسم الدفعة</span><input name="name" required defaultValue="دفعة الطلاب الجديدة" /></label><label className="field"><span>كود الدفعة</span><input name="code" required defaultValue={`BATCH-${Date.now().toString().slice(-6)}`} /></label>
    <label className="field"><span>الفرع</span><select name="branchId" required>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label><label className="field"><span>نوع الكروت</span><select name="cardType" defaultValue="STUDENT">{Object.entries(cardTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label className="field full"><span>التصميم</span><select name="templateId" required>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label>
    <label className="field"><span>بادئة الرقم</span><input name="prefix" required defaultValue="STOCK" /></label><label className="field"><span>بداية التسلسل</span><input name="startNumber" type="number" min="1" required defaultValue="1" /></label><label className="field"><span>الكمية</span><input name="quantity" type="number" min="1" max="500" required defaultValue="50" /></label><label className="field"><span>ملاحظات</span><input name="notes" /></label>
    {error ? <p className="form-error full">{error}</p> : null}<div className="form-actions full"><button type="button" className="secondary-action" onClick={onCancel}>إلغاء</button><button className="primary-action" disabled={saving}>{saving ? 'جارٍ إنشاء الدفعة...' : 'إنشاء الكروت بالمخزون'}</button></div>
  </form>;
}

function PrintForm({ templates, saving, error, onSubmit, onCancel }: { templates: CardTemplateRow[]; saving: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <form className="form-grid" onSubmit={onSubmit}>
    <label className="field full"><span>اسم مهمة الطباعة</span><input name="name" required defaultValue={`طباعة كروت ${new Date().toLocaleDateString('ar-EG')}`} /></label>
    <label className="field"><span>تخطيط الصورة</span><select name="layout" defaultValue="A4_8_UP"><option value="A4_8_UP">A4 — 8 كروت</option><option value="A4_10_UP">A4 — 10 كروت</option><option value="SINGLE">صورة منفردة</option></select></label>
    <label className="field"><span>الأوجه المطلوبة</span><select name="sideSelection" defaultValue="FRONT"><option value="FRONT">الوجه الأمامي</option><option value="BACK">الوجه الخلفي</option><option value="BOTH">الوجهين — صفحات أمامية ثم خلفية</option></select></label>
    <label className="field full"><span>فرض تصميم — اختياري</span><select name="templateId" defaultValue=""><option value="">تصميم كل كارت</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label>
    {error ? <p className="form-error full">{error}</p> : null}
    <div className="form-actions full"><button type="button" className="secondary-action" onClick={onCancel}>إلغاء</button><button className="primary-action" disabled={saving}>{saving ? 'جارٍ إنشاء ملف الطباعة...' : 'إنشاء وتنزيل الصفحة الأولى'}</button></div>
  </form>;
}

function CardPreviewModal({ card, onClose }: { card: SmartCardRow; onClose: () => void }) {
  type SelectedSide = 'front' | 'back';
  const [frontUrl, setFrontUrl] = useState('');
  const [backUrl, setBackUrl] = useState('');
  const [selectedSides, setSelectedSides] = useState<Set<SelectedSide>>(new Set(['front']));
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let front = '';
    let back = '';
    setLoading(true);
    Promise.all([
      requestBlob(`/smart-cards/${card.id}/image?side=front&format=png`),
      requestBlob(`/smart-cards/${card.id}/image?side=back&format=png`),
    ])
      .then(([frontBlob, backBlob]) => {
        front = URL.createObjectURL(frontBlob);
        back = URL.createObjectURL(backBlob);
        setFrontUrl(front);
        setBackUrl(back);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر إنشاء صورة الكارت'))
      .finally(() => setLoading(false));
    return () => { if (front) URL.revokeObjectURL(front); if (back) URL.revokeObjectURL(back); };
  }, [card.id]);

  const selection = selectedSides.size === 2 ? 'both' : selectedSides.has('back') ? 'back' : 'front';

  function toggleSide(side: SelectedSide) {
    setSelectedSides((current) => {
      const next = new Set(current);
      if (next.has(side)) {
        if (next.size > 1) next.delete(side);
      } else next.add(side);
      return next;
    });
  }

  async function downloadSelected() {
    setWorking(true);
    try {
      const blob = await requestBlob(`/smart-cards/${card.id}/image?side=${selection}&format=png&download=1`);
      downloadBlob(blob, `${card.publicCode}-${selection}.png`);
    } finally {
      setWorking(false);
    }
  }

  async function shareSelected() {
    setWorking(true);
    try {
      const blob = await requestBlob(`/smart-cards/${card.id}/image?side=${selection}&format=png`);
      const file = new File([blob], `${card.publicCode}-${selection}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: card.ownerName ?? card.publicCode, files: [file] });
      } else downloadBlob(blob, file.name);
    } finally {
      setWorking(false);
    }
  }

  async function printSelected() {
    const popup = window.open('', '_blank', 'width=1100,height=850');
    if (!popup) {
      setError('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مرة أخرى.');
      return;
    }
    popup.document.write('<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>جاري تجهيز الطباعة...</title></head><body>جاري تجهيز صورة الكارت...</body></html>');
    popup.document.close();
    setWorking(true);
    try {
      const sides: SelectedSide[] = selection === 'both' ? ['front', 'back'] : [selection];
      const blobs = await Promise.all(sides.map((side) => requestBlob(`/smart-cards/${card.id}/image?side=${side}&format=png`)));
      const urls = blobs.map((blob) => URL.createObjectURL(blob));
      popup.document.open();
      popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${card.publicCode}</title><style>
        @page { size: 85.6mm 53.98mm; margin: 0; }
        html,body{margin:0;padding:0;background:#fff}
        .page{width:85.6mm;height:53.98mm;display:grid;place-items:center;break-after:page;page-break-after:always;overflow:hidden}
        .page:last-child{break-after:auto;page-break-after:auto}
        img{width:85.6mm;height:53.98mm;object-fit:fill;display:block}
      </style></head><body>${urls.map((url) => `<section class="page"><img src="${url}" /></section>`).join('')}</body></html>`);
      popup.document.close();
      await Promise.all(Array.from(popup.document.images).map((image) => image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
      popup.onafterprint = () => popup.close();
      popup.focus();
      popup.print();
      setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 60_000);
    } catch (reason) {
      popup.close();
      setError(reason instanceof Error ? reason.message : 'تعذر تجهيز الطباعة');
    } finally {
      setWorking(false);
    }
  }

  async function downloadAsset(path: string, filename: string) {
    downloadBlob(await requestBlob(path), filename);
  }

  return <Modal title={`معاينة الكارت — ${card.publicCode}`} onClose={onClose}>{loading ? <LoadingState /> : error && !frontUrl ? <ErrorState message={error} retry={() => window.location.reload()} /> : <div className="card-preview-workspace">
    <div className="card-selection-help"><strong>حدد الصور المطلوبة</strong><span>اضغط على الوجه الأمامي أو الخلفي؛ الحفظ والمشاركة والطباعة ستستخدم الأوجه المحددة فقط.</span></div>
    <div className="card-preview-stage">
      <button type="button" className={`card-side-option ${selectedSides.has('front') ? 'selected' : ''}`} onClick={() => toggleSide('front')}><span><Check size={15} /> الوجه الأمامي</span>{frontUrl ? <img src={frontUrl} alt="الوجه الأمامي للكارت" /> : null}</button>
      <button type="button" className={`card-side-option ${selectedSides.has('back') ? 'selected' : ''}`} onClick={() => toggleSide('back')}><span><Check size={15} /> الوجه الخلفي</span>{backUrl ? <img src={backUrl} alt="الوجه الخلفي للكارت" /> : null}</button>
    </div>
    {error ? <p className="form-error">{error}</p> : null}
    <div className="card-image-actions">
      <button className="primary-action" disabled={working} onClick={() => void shareSelected()}><Share2 size={17} /> مشاركة المحدد</button>
      <button className="secondary-action" disabled={working} onClick={() => void downloadSelected()}><Download size={17} /> حفظ المحدد PNG</button>
      <button className="secondary-action" onClick={() => void downloadAsset(`/smart-cards/${card.id}/code-image?kind=qr&format=png&download=1`, `${card.publicCode}-qr.png`)}><QrCode size={17} /> صورة QR</button>
      <button className="secondary-action" onClick={() => void downloadAsset(`/smart-cards/${card.id}/code-image?kind=barcode&format=png&download=1`, `${card.publicCode}-barcode.png`)}><Barcode size={17} /> صورة Barcode</button>
      <button className="secondary-action" disabled={working} onClick={() => void printSelected()}><Printer size={17} /> طباعة المحدد</button>
    </div>
    <div className="security-notice"><ImageIcon size={20} /><div><strong>الطباعة مكتملة بمقاس CR80.</strong><span>عند تحديد الوجهين يفتح كل وجه في صفحة منفصلة جاهزة للطباعة على الوجهين.</span></div></div>
  </div>}</Modal>;
}

