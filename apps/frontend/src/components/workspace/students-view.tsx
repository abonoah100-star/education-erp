'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CreditCard,
  Eye,
  FileText,
  GraduationCap,
  ImagePlus,
  Link2,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  StickyNote,
  Upload,
  UserCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  downloadBlob,
  request,
  requestBlob,
  requestFormData,
} from '@/lib/api';
import type {
  AuthorizedPickupRow,
  BranchRef,
  BranchRow,
  CardTemplateRow,
  DuplicateStudentRow,
  GuardianDetails,
  GuardianRelationship,
  GuardianRow,
  PagedResult,
  StudentDetails,
  StudentDocumentRow,
  StudentGender,
  StudentRow,
  StudentStatus,
  SmartCardRow,
} from '@/lib/models';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  SectionHeader,
  StatusPill,
} from './ui';
import { ProtectedPhoto } from './protected-photo';

type DirectoryMode = 'students' | 'guardians' | 'pickups';
type ProfileTab = 'overview' | 'guardians' | 'pickups' | 'documents' | 'notes' | 'cards' | 'history';

type CardChoice = 'NONE' | 'ISSUE' | 'ASSIGN';

const statusLabels: Record<StudentStatus, string> = {
  DRAFT: 'مسودة',
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  WITHDRAWN: 'منسحب',
  GRADUATED: 'متخرج',
  ARCHIVED: 'مؤرشف',
};

const guardianStatusLabels = {
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  ARCHIVED: 'مؤرشف',
};

const pickupStatusLabels = {
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  EXPIRED: 'منتهي',
  ARCHIVED: 'مؤرشف',
};

const relationshipLabels: Record<GuardianRelationship, string> = {
  FATHER: 'الأب',
  MOTHER: 'الأم',
  BROTHER: 'الأخ',
  SISTER: 'الأخت',
  GRANDFATHER: 'الجد',
  GRANDMOTHER: 'الجدة',
  UNCLE: 'العم / الخال',
  AUNT: 'العمة / الخالة',
  GUARDIAN: 'وصي',
  OTHER: 'أخرى',
};

const relationships = Object.entries(relationshipLabels) as Array<[GuardianRelationship, string]>;

function dateText(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(value)) : '—';
}

function buildQuery(values: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

function studentPhotoPath(student: Pick<StudentRow, 'id' | 'profilePhotoAssetId'>) {
  return student.profilePhotoAssetId ? `/students/${student.id}/photo` : null;
}

interface StudentsViewProps {
  permissions: string[];
  sessionBranches: BranchRef[];
}

function branchRefRows(branches: BranchRef[]): BranchRow[] {
  return branches.map((branch) => ({
    ...branch,
    address: null,
    phone: null,
    isActive: true,
    createdAt: '',
    usersCount: 0,
    cashboxes: [],
  }));
}

export function StudentsView({ permissions, sessionBranches }: StudentsViewProps) {
  const [mode, setMode] = useState<DirectoryMode>('students');
  const [branches, setBranches] = useState<BranchRow[]>(() => branchRefRows(sessionBranches));
  const [templates, setTemplates] = useState<CardTemplateRow[]>([]);
  const [stockCards, setStockCards] = useState<SmartCardRow[]>([]);
  const [loadingReference, setLoadingReference] = useState(true);
  const [referenceError, setReferenceError] = useState('');
  const [version, setVersion] = useState(0);

  const can = (permission: string) => permissions.includes(permission);

  useEffect(() => {
    setLoadingReference(true);
    setReferenceError('');
    Promise.all([
      can('branches.view')
        ? request<{ items: BranchRow[] }>('/workspace/branches')
        : Promise.resolve({ items: branchRefRows(sessionBranches) }),
      can('card_templates.view')
        ? request<{ items: CardTemplateRow[] }>('/smart-cards/templates')
        : Promise.resolve({ items: [] as CardTemplateRow[] }),
      can('smart_cards.view')
        ? request<{ items: SmartCardRow[] }>('/smart-cards?status=IN_STOCK')
        : Promise.resolve({ items: [] as SmartCardRow[] }),
    ])
      .then(([branchResult, templateResult, cardResult]) => {
        setBranches(branchResult.items);
        setTemplates(templateResult.items.filter((template) => template.isActive && template.cardType === 'STUDENT'));
        setStockCards(cardResult.items.filter((card) => card.status === 'IN_STOCK' && card.cardType === 'STUDENT'));
      })
      .catch((reason: unknown) => setReferenceError(reason instanceof Error ? reason.message : 'تعذر تحميل بيانات الوحدة'))
      .finally(() => setLoadingReference(false));
  }, [version]);

  if (loadingReference) return <LoadingState />;
  if (referenceError) return <ErrorState message={referenceError} retry={() => setVersion((value) => value + 1)} />;

  return (
    <div className="people-workspace">
      <SectionHeader
        eyebrow="إدارة ملفات المتعلمين"
        title="الطلاب وأولياء الأمور"
        description="ملف مركزي موحد للطالب وعلاقاته ومستنداته وكروته، مع عزل كامل بين الفروع وسجل لكل تغيير."
      />
      <div className="segmented-navigation people-tabs">
        <button className={mode === 'students' ? 'active' : ''} onClick={() => setMode('students')}>
          <GraduationCap size={17} /> الطلاب
        </button>
        <button className={mode === 'guardians' ? 'active' : ''} onClick={() => setMode('guardians')}>
          <UsersRound size={17} /> أولياء الأمور
        </button>
        <button className={mode === 'pickups' ? 'active' : ''} onClick={() => setMode('pickups')}>
          <ShieldCheck size={17} /> المصرح لهم بالاستلام
        </button>
      </div>

      {mode === 'students' ? (
        <StudentsDirectory
          branches={branches}
          templates={templates}
          permissions={permissions}
          stockCards={stockCards}
        />
      ) : null}
      {mode === 'guardians' ? <GuardiansDirectory permissions={permissions} /> : null}
      {mode === 'pickups' ? <PickupsDirectory /> : null}
    </div>
  );
}

function StudentsDirectory({
  branches,
  templates,
  permissions,
  stockCards,
}: {
  branches: BranchRow[];
  templates: CardTemplateRow[];
  permissions: string[];
  stockCards: SmartCardRow[];
}) {
  const [result, setResult] = useState<PagedResult<StudentRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const can = (permission: string) => permissions.includes(permission);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      request<PagedResult<StudentRow>>(
        `/students?${buildQuery({ page, pageSize: 20, search, branchId, status })}`,
      )
        .then(setResult)
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل الطلاب'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [branchId, page, search, status, version]);

  const summary = useMemo(() => {
    const rows = result?.items ?? [];
    return {
      total: result?.pagination.total ?? 0,
      active: rows.filter((row) => row.status === 'ACTIVE').length,
      withoutGuardian: rows.filter((row) => row.guardiansCount === 0).length,
      withoutCard: rows.filter((row) => row.cardsCount === 0).length,
    };
  }, [result]);

  return (
    <>
      <div className="people-toolbar">
        <label className="directory-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="ابحث بالاسم أو الكود أو الهاتف أو هاتف ولي الأمر..."
          />
        </label>
        <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1); }}>
          <option value="">كل الفروع</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">كل الحالات</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {can('students.create') ? (
          <button className="primary-action" onClick={() => setShowRegistration(true)}>
            <UserPlus size={18} /> تسجيل طالب
          </button>
        ) : null}
      </div>

      <div className="people-stat-strip">
        <div><strong>{summary.total}</strong><span>إجمالي النتائج</span></div>
        <div><strong>{summary.active}</strong><span>نشط في الصفحة</span></div>
        <div className={summary.withoutGuardian ? 'needs-attention' : ''}><strong>{summary.withoutGuardian}</strong><span>دون ولي أمر</span></div>
        <div className={summary.withoutCard ? 'needs-attention' : ''}><strong>{summary.withoutCard}</strong><span>دون كارت</span></div>
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} retry={() => setVersion((value) => value + 1)} /> : null}
      {!loading && !error && !result?.items.length ? (
        <EmptyState title="لا توجد ملفات مطابقة" description="غيّر عوامل البحث أو ابدأ بتسجيل أول طالب." />
      ) : null}
      {!loading && !error && result?.items.length ? (
        <section className="student-directory-surface">
          <header className="student-directory-head">
            <span>الطالب</span><span>ولي الأمر</span><span>الفرع والدراسة</span><span>الملف</span><span>الحالة</span><span />
          </header>
          {result.items.map((student) => (
            <article className="student-directory-row" key={student.id}>
              <div className="student-identity-cell">
                <ProtectedPhoto
                  className="student-list-photo"
                  src={studentPhotoPath(student)}
                  alt={student.nameArabic}
                />
                <div><strong>{student.nameArabic}</strong><span>{student.code}{student.nameEnglish ? ` · ${student.nameEnglish}` : ''}</span></div>
              </div>
              <div className="student-guardian-cell">
                {student.primaryGuardian ? (
                  <><strong>{student.primaryGuardian.nameArabic}</strong><span>{student.primaryGuardian.primaryPhone}</span></>
                ) : <span className="missing-value">لم يُربط ولي أمر</span>}
              </div>
              <div className="student-study-cell">
                <strong>{student.branch.name}</strong>
                <span>{[student.schoolName, student.gradeLevel].filter(Boolean).join(' · ') || 'لم تُحدد بيانات الدراسة'}</span>
              </div>
              <div className="student-count-cell">
                <span>{student.guardiansCount} أولياء</span>
                <span>{student.documentsCount} مستندات</span>
                <span>{student.cardsCount} كروت</span>
              </div>
              <StatusPill
                active={student.status === 'ACTIVE'}
                activeText={statusLabels[student.status]}
                inactiveText={statusLabels[student.status]}
              />
              <button className="icon-button" title="فتح ملف الطالب" onClick={() => setSelectedStudentId(student.id)}>
                <Eye size={17} />
              </button>
            </article>
          ))}
          <footer className="directory-pagination">
            <span>صفحة {result.pagination.page} من {result.pagination.pages} · {result.pagination.total} طالب</span>
            <div>
              <button className="secondary-action" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ArrowRight size={16} /> السابق</button>
              <button className="secondary-action" disabled={page >= result.pagination.pages} onClick={() => setPage((value) => value + 1)}>التالي <ArrowLeft size={16} /></button>
            </div>
          </footer>
        </section>
      ) : null}

      {showRegistration ? (
        <RegistrationWizard
          branches={branches}
          templates={templates}
          canIssueCard={can('smart_cards.issue')}
          stockCards={stockCards}
          onClose={() => setShowRegistration(false)}
          onCreated={(studentId) => {
            setShowRegistration(false);
            setVersion((value) => value + 1);
            setSelectedStudentId(studentId);
          }}
        />
      ) : null}

      {selectedStudentId ? (
        <StudentProfileModal
          studentId={selectedStudentId}
          branches={branches}
          templates={templates}
          permissions={permissions}
          stockCards={stockCards}
          onClose={() => setSelectedStudentId(null)}
          onChanged={() => setVersion((value) => value + 1)}
        />
      ) : null}
    </>
  );
}

interface RegistrationData {
  branchId: string;
  nameArabic: string;
  nameEnglish: string;
  gender: '' | StudentGender;
  birthDate: string;
  nationalId: string;
  schoolName: string;
  gradeLevel: string;
  phone: string;
  whatsappPhone: string;
  address: string;
  healthNotes: string;
  adminNotes: string;
  referralSource: string;
  status: 'ACTIVE' | 'DRAFT';
  guardianName: string;
  guardianPhone: string;
  guardianWhatsapp: string;
  guardianEmail: string;
  guardianRelationship: GuardianRelationship;
  guardianPrimary: boolean;
  guardianFinancial: boolean;
  guardianNotifications: boolean;
  pickupName: string;
  pickupPhone: string;
  pickupRelationship: GuardianRelationship;
  pickupValidUntil: string;
  pickupNotes: string;
  cardChoice: CardChoice;
  templateId: string;
  documentTitle: string;
  documentType: string;
  inventoryCardId: string;
}

function RegistrationWizard({
  branches,
  templates,
  canIssueCard,
  stockCards,
  onClose,
  onCreated,
}: {
  branches: BranchRow[];
  templates: CardTemplateRow[];
  canIssueCard: boolean;
  stockCards: SmartCardRow[];
  onClose: () => void;
  onCreated: (studentId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicateStudentRow[]>([]);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [data, setData] = useState<RegistrationData>({
    branchId: branches[0]?.id ?? '',
    nameArabic: '', nameEnglish: '', gender: '', birthDate: '', nationalId: '', schoolName: '', gradeLevel: '',
    phone: '', whatsappPhone: '', address: '', healthNotes: '', adminNotes: '', referralSource: '', status: 'ACTIVE',
    guardianName: '', guardianPhone: '', guardianWhatsapp: '', guardianEmail: '', guardianRelationship: 'FATHER',
    guardianPrimary: true, guardianFinancial: true, guardianNotifications: true,
    pickupName: '', pickupPhone: '', pickupRelationship: 'OTHER', pickupValidUntil: '', pickupNotes: '',
    cardChoice: 'NONE', templateId: templates[0]?.id ?? '', documentTitle: '', documentType: 'BIRTH_CERTIFICATE', inventoryCardId: stockCards[0]?.id ?? '',
  });

  function update<K extends keyof RegistrationData>(key: K, value: RegistrationData[K]) {
    setData((current) => ({ ...current, [key]: value }));
    if (['nameArabic', 'birthDate', 'nationalId', 'phone'].includes(key)) setDuplicateChecked(false);
  }

  async function checkDuplicates() {
    if (!data.nameArabic.trim()) {
      setError('اكتب اسم الطالب أولًا');
      return false;
    }
    setError('');
    try {
      const query = buildQuery({
        nameArabic: data.nameArabic,
        birthDate: data.birthDate,
        nationalId: data.nationalId,
        phone: data.phone || data.guardianPhone,
      });
      const result = await request<{ items: DuplicateStudentRow[] }>(`/students/duplicates?${query}`);
      setDuplicates(result.items.filter((item) => item.score > 0));
      setDuplicateChecked(true);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر فحص التكرار');
      return false;
    }
  }

  async function next() {
    if (step === 1 && !duplicateChecked) {
      const checked = await checkDuplicates();
      if (!checked) return;
    }
    setStep((value) => Math.min(6, value + 1));
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      let guardianId: string | undefined;
      if (data.guardianName.trim()) {
        if (!data.guardianPhone.trim()) throw new Error('رقم هاتف ولي الأمر مطلوب');
        const guardian = await request<{ id: string }>('/guardians', {
          method: 'POST',
          body: JSON.stringify({
            nameArabic: data.guardianName,
            primaryPhone: data.guardianPhone,
            whatsappPhone: data.guardianWhatsapp || undefined,
            email: data.guardianEmail || undefined,
          }),
        });
        guardianId = guardian.id;
      }

      const student = await request<StudentRow>('/students', {
        method: 'POST',
        body: JSON.stringify({
          branchId: data.branchId,
          nameArabic: data.nameArabic,
          nameEnglish: data.nameEnglish || undefined,
          gender: data.gender || undefined,
          birthDate: data.birthDate || undefined,
          nationalId: data.nationalId || undefined,
          schoolName: data.schoolName || undefined,
          gradeLevel: data.gradeLevel || undefined,
          phone: data.phone || undefined,
          whatsappPhone: data.whatsappPhone || undefined,
          address: data.address || undefined,
          healthNotes: data.healthNotes || undefined,
          adminNotes: data.adminNotes || undefined,
          referralSource: data.referralSource || undefined,
          status: data.status,
          guardianLinks: guardianId ? [{
            guardianId,
            relationship: data.guardianRelationship,
            isPrimary: data.guardianPrimary,
            isFinancialResponsible: data.guardianFinancial,
            receivesNotifications: data.guardianNotifications,
            canPickup: true,
          }] : undefined,
        }),
      });

      if (photo) {
        const form = new FormData();
        form.append('file', photo);
        await requestFormData(`/students/${student.id}/photo`, form);
      }

      if (data.pickupName.trim()) {
        if (!data.pickupPhone.trim()) throw new Error('رقم هاتف المصرح له مطلوب');
        await request('/authorized-pickups', {
          method: 'POST',
          body: JSON.stringify({
            nameArabic: data.pickupName,
            relationship: data.pickupRelationship,
            customRelationship: data.pickupRelationship === 'OTHER' ? 'مصرح له' : undefined,
            phone: data.pickupPhone,
            validUntil: data.pickupValidUntil || undefined,
            securityNotes: data.pickupNotes || undefined,
            studentIds: [student.id],
          }),
        });
      }

      if (document) {
        const form = new FormData();
        form.append('file', document);
        form.append('documentType', data.documentType);
        form.append('title', data.documentTitle || document.name);
        await requestFormData(`/students/${student.id}/documents`, form);
      }

      if (data.cardChoice === 'ISSUE' && data.templateId) {
        await request(`/students/${student.id}/cards/issue`, {
          method: 'POST',
          body: JSON.stringify({ templateId: data.templateId, codeFormat: 'QR_AND_BARCODE' }),
        });
      }
      if (data.cardChoice === 'ASSIGN' && data.inventoryCardId && data.templateId) {
        await request(`/students/${student.id}/cards/assign-existing`, {
          method: 'POST',
          body: JSON.stringify({ cardId: data.inventoryCardId, templateId: data.templateId }),
        });
      }

      onCreated(student.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تسجيل الطالب');
    } finally {
      setSaving(false);
    }
  }

  const steps = ['الطالب', 'ولي الأمر', 'الاستلام', 'الملفات والكارت', 'المراجعة', 'الحفظ'];

  return (
    <Modal title="تسجيل طالب جديد" onClose={onClose}>
      <div className="registration-wizard">
        <div className="wizard-steps">
          {steps.map((label, index) => (
            <div key={label} className={`${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'done' : ''}`}>
              <span>{step > index + 1 ? <Check size={14} /> : index + 1}</span><strong>{label}</strong>
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="wizard-panel form-grid">
            <Field label="الفرع"><select value={data.branchId} onChange={(event) => update('branchId', event.target.value)} required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
            <Field label="الاسم العربي"><input value={data.nameArabic} onChange={(event) => update('nameArabic', event.target.value)} required /></Field>
            <Field label="الاسم الإنجليزي"><input value={data.nameEnglish} onChange={(event) => update('nameEnglish', event.target.value)} /></Field>
            <Field label="النوع"><select value={data.gender} onChange={(event) => update('gender', event.target.value as '' | StudentGender)}><option value="">غير محدد</option><option value="MALE">ذكر</option><option value="FEMALE">أنثى</option></select></Field>
            <Field label="تاريخ الميلاد"><input type="date" value={data.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></Field>
            <Field label="رقم الهوية"><input value={data.nationalId} onChange={(event) => update('nationalId', event.target.value)} /></Field>
            <Field label="هاتف الطالب"><input value={data.phone} onChange={(event) => update('phone', event.target.value)} /></Field>
            <Field label="واتساب"><input value={data.whatsappPhone} onChange={(event) => update('whatsappPhone', event.target.value)} /></Field>
            <Field label="المدرسة"><input value={data.schoolName} onChange={(event) => update('schoolName', event.target.value)} /></Field>
            <Field label="الصف الحالي"><input value={data.gradeLevel} onChange={(event) => update('gradeLevel', event.target.value)} placeholder="مؤقتًا لحين وحدة الصفوف الأكاديمية" /></Field>
            <Field label="العنوان" full><textarea value={data.address} onChange={(event) => update('address', event.target.value)} /></Field>
            <Field label="مصدر معرفة المركز"><input value={data.referralSource} onChange={(event) => update('referralSource', event.target.value)} /></Field>
            <Field label="حالة الملف"><select value={data.status} onChange={(event) => update('status', event.target.value as 'ACTIVE' | 'DRAFT')}><option value="ACTIVE">نشط</option><option value="DRAFT">مسودة</option></select></Field>
            {duplicateChecked ? (
              <div className={`duplicate-review full ${duplicates.length ? 'has-matches' : ''}`}>
                <strong>{duplicates.length ? `وجدنا ${duplicates.length} ملفًا محتملًا` : 'لا توجد نتائج تكرار واضحة'}</strong>
                {duplicates.slice(0, 4).map((item) => <span key={item.id}>{item.nameArabic} · {item.code} · درجة {item.score} — {item.reasons.join('، ')}</span>)}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-panel form-grid">
            <div className="wizard-context full"><UsersRound size={22} /><div><strong>ولي أمر جديد اختياري</strong><span>سيُنشأ ملف مستقل ويمكن ربطه بأكثر من طالب لاحقًا.</span></div></div>
            <Field label="اسم ولي الأمر"><input value={data.guardianName} onChange={(event) => update('guardianName', event.target.value)} /></Field>
            <Field label="الهاتف الأساسي"><input value={data.guardianPhone} onChange={(event) => update('guardianPhone', event.target.value)} /></Field>
            <Field label="واتساب"><input value={data.guardianWhatsapp} onChange={(event) => update('guardianWhatsapp', event.target.value)} /></Field>
            <Field label="البريد الإلكتروني"><input type="email" value={data.guardianEmail} onChange={(event) => update('guardianEmail', event.target.value)} /></Field>
            <Field label="صلة القرابة"><RelationshipSelect value={data.guardianRelationship} onChange={(value) => update('guardianRelationship', value)} /></Field>
            <div className="checkbox-stack">
              <label><input type="checkbox" checked={data.guardianPrimary} onChange={(event) => update('guardianPrimary', event.target.checked)} /> ولي الأمر الرئيسي</label>
              <label><input type="checkbox" checked={data.guardianFinancial} onChange={(event) => update('guardianFinancial', event.target.checked)} /> المسؤول المالي</label>
              <label><input type="checkbox" checked={data.guardianNotifications} onChange={(event) => update('guardianNotifications', event.target.checked)} /> يستقبل الإشعارات</label>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-panel form-grid">
            <div className="wizard-context full"><ShieldCheck size={22} /><div><strong>مصرح له بالاستلام اختياري</strong><span>يمكن إكمال قائمة المصرح لهم لاحقًا من ملف الطالب.</span></div></div>
            <Field label="الاسم"><input value={data.pickupName} onChange={(event) => update('pickupName', event.target.value)} /></Field>
            <Field label="الهاتف"><input value={data.pickupPhone} onChange={(event) => update('pickupPhone', event.target.value)} /></Field>
            <Field label="صلة القرابة"><RelationshipSelect value={data.pickupRelationship} onChange={(value) => update('pickupRelationship', value)} /></Field>
            <Field label="صالح حتى"><input type="date" value={data.pickupValidUntil} onChange={(event) => update('pickupValidUntil', event.target.value)} /></Field>
            <Field label="ملاحظات أمنية" full><textarea value={data.pickupNotes} onChange={(event) => update('pickupNotes', event.target.value)} /></Field>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizard-panel form-grid">
            <Field label="صورة الطالب" full>
              <label className="file-drop"><ImagePlus size={22} /><span>{photo ? photo.name : 'اختر JPG أو PNG أو WebP'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
            </Field>
            <Field label="مستند أولي" full>
              <label className="file-drop"><FileText size={22} /><span>{document ? document.name : 'اختياري: شهادة ميلاد أو مستند تسجيل'}</span><input type="file" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} /></label>
            </Field>
            {document ? <><Field label="عنوان المستند"><input value={data.documentTitle} onChange={(event) => update('documentTitle', event.target.value)} /></Field><Field label="نوع المستند"><select value={data.documentType} onChange={(event) => update('documentType', event.target.value)}><option value="BIRTH_CERTIFICATE">شهادة ميلاد</option><option value="GUARDIAN_ID">هوية ولي الأمر</option><option value="MEDICAL_REPORT">تقرير طبي</option><option value="PHOTO">صورة</option><option value="OTHER">أخرى</option></select></Field></> : null}
            {canIssueCard ? (
              <><Field label="الكارت الذكي"><select value={data.cardChoice} onChange={(event) => update('cardChoice', event.target.value as CardChoice)}><option value="NONE">لا تصدر الآن</option><option value="ISSUE">إصدار كارت جديد</option>{stockCards.length ? <option value="ASSIGN">ربط كارت موجود من المخزون</option> : null}</select></Field>
              {data.cardChoice !== 'NONE' ? <Field label="تصميم الكارت"><select value={data.templateId} onChange={(event) => update('templateId', event.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field> : null}{data.cardChoice === 'ASSIGN' ? <Field label="كارت المخزون"><select value={data.inventoryCardId} onChange={(event) => update('inventoryCardId', event.target.value)}>{stockCards.map((card) => <option key={card.id} value={card.id}>{card.publicCode} · {card.branch?.name || 'دون فرع'}</option>)}</select></Field> : null}</>
            ) : null}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="wizard-panel review-sheet">
            <ReviewBlock icon={<GraduationCap size={20} />} title="الطالب" lines={[data.nameArabic, branches.find((branch) => branch.id === data.branchId)?.name ?? '', [data.schoolName, data.gradeLevel].filter(Boolean).join(' · ')]} />
            <ReviewBlock icon={<UsersRound size={20} />} title="ولي الأمر" lines={data.guardianName ? [data.guardianName, data.guardianPhone, relationshipLabels[data.guardianRelationship]] : ['لن تتم إضافة ولي أمر الآن']} />
            <ReviewBlock icon={<ShieldCheck size={20} />} title="الاستلام" lines={data.pickupName ? [data.pickupName, data.pickupPhone] : ['لا يوجد مصرح له جديد']} />
            <ReviewBlock icon={<CreditCard size={20} />} title="الكارت والملفات" lines={[photo ? 'صورة الطالب مرفقة' : 'سيُستخدم الشكل الافتراضي', document ? `مستند: ${document.name}` : 'دون مستند أولي', data.cardChoice === 'ISSUE' ? 'إصدار كارت بعد الحفظ' : data.cardChoice === 'ASSIGN' ? 'ربط كارت من المخزون' : 'دون كارت الآن']} />
          </div>
        ) : null}

        {step === 6 ? (
          <div className="wizard-panel final-confirmation">
            <Check size={38} />
            <strong>البيانات جاهزة للحفظ</strong>
            <p>سيتم تنفيذ إنشاء الملفات والعلاقات والصورة والمستند والكارت بالتسلسل، وستظهر أي مشكلة بوضوح دون فقد ملف الطالب الأساسي.</p>
          </div>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}
        <div className="wizard-actions">
          <button className="secondary-action" disabled={saving} onClick={step === 1 ? onClose : () => setStep((value) => Math.max(1, value - 1))}>{step === 1 ? 'إلغاء' : 'السابق'}</button>
          {step < 6 ? <button className="primary-action" disabled={saving} onClick={() => void next()}>التالي</button> : <button className="primary-action" disabled={saving} onClick={() => void submit()}>{saving ? 'جارٍ تسجيل الملف...' : 'تسجيل الطالب'}</button>}
        </div>
      </div>
    </Modal>
  );
}

function StudentProfileModal({
  studentId,
  branches,
  templates,
  permissions,
  stockCards,
  onClose,
  onChanged,
}: {
  studentId: string;
  branches: BranchRow[];
  templates: CardTemplateRow[];
  permissions: string[];
  stockCards: SmartCardRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [version, setVersion] = useState(0);
  const [formMode, setFormMode] = useState<'note' | 'document' | 'guardian' | 'pickup' | 'status' | 'branch' | 'card' | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const can = (permission: string) => permissions.includes(permission);

  useEffect(() => {
    setLoading(true);
    setError('');
    request<StudentDetails>(`/students/${studentId}`)
      .then(setStudent)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل ملف الطالب'))
      .finally(() => setLoading(false));
  }, [studentId, version]);

  async function refresh() {
    setFormMode(null);
    setVersion((value) => value + 1);
    onChanged();
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setFormError('');
    try {
      const form = new FormData();
      form.append('file', file);
      await requestFormData(`/students/${studentId}/photo`, form);
      await refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر رفع الصورة');
    } finally {
      setSaving(false);
    }
  }

  async function submitProfileForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student || !formMode) return;
    setSaving(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      if (formMode === 'note') {
        await request(`/students/${student.id}/notes`, { method: 'POST', body: JSON.stringify({ category: form.get('category'), content: form.get('content'), isSensitive: form.get('isSensitive') === 'on' }) });
      }
      if (formMode === 'document') {
        const file = form.get('file');
        if (!(file instanceof File) || !file.size) throw new Error('اختر ملف المستند');
        await requestFormData(`/students/${student.id}/documents`, form);
      }
      if (formMode === 'guardian') {
        const guardian = await request<{ id: string }>('/guardians', { method: 'POST', body: JSON.stringify({ nameArabic: form.get('nameArabic'), primaryPhone: form.get('primaryPhone'), whatsappPhone: form.get('whatsappPhone') || undefined, email: form.get('email') || undefined }) });
        await request(`/guardians/link/student/${student.id}`, { method: 'POST', body: JSON.stringify({ guardianId: guardian.id, relationship: form.get('relationship'), customRelationship: form.get('relationship') === 'OTHER' ? form.get('customRelationship') : undefined, isPrimary: form.get('isPrimary') === 'on', isFinancialResponsible: form.get('isFinancialResponsible') === 'on', receivesNotifications: form.get('receivesNotifications') === 'on', canPickup: true }) });
      }
      if (formMode === 'pickup') {
        await request('/authorized-pickups', { method: 'POST', body: JSON.stringify({ nameArabic: form.get('nameArabic'), relationship: form.get('relationship'), customRelationship: form.get('relationship') === 'OTHER' ? form.get('customRelationship') : undefined, phone: form.get('phone'), nationalId: form.get('nationalId') || undefined, validUntil: form.get('validUntil') || undefined, securityNotes: form.get('securityNotes') || undefined, studentIds: [student.id] }) });
      }
      if (formMode === 'status') {
        await request(`/students/${student.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: form.get('status'), reason: form.get('reason') || undefined }) });
      }
      if (formMode === 'branch') {
        await request(`/students/${student.id}/branch`, { method: 'PATCH', body: JSON.stringify({ branchId: form.get('branchId'), reason: form.get('reason') }) });
      }
      if (formMode === 'card') {
        const cardAction = form.get('cardAction');
        if (cardAction === 'ASSIGN') {
          await request(`/students/${student.id}/cards/assign-existing`, { method: 'POST', body: JSON.stringify({ cardId: form.get('cardId'), templateId: form.get('templateId') }) });
        } else {
          await request(`/students/${student.id}/cards/issue`, { method: 'POST', body: JSON.stringify({ templateId: form.get('templateId'), codeFormat: 'QR_AND_BARCODE' }) });
        }
      }
      await refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'تعذر تنفيذ العملية');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={student ? `${student.nameArabic} — ${student.code}` : 'ملف الطالب'} onClose={onClose}>
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} retry={() => setVersion((value) => value + 1)} /> : null}
      {student ? (
        <div className="student-profile">
          <header className="student-profile-hero">
            <div className="student-profile-photo-wrap">
              <ProtectedPhoto className="student-profile-photo" src={studentPhotoPath(student)} alt={student.nameArabic} />
              {can('students.update') ? <label className="photo-upload-button"><ImagePlus size={16} /> تغيير الصورة<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadPhoto(event)} /></label> : null}
            </div>
            <div className="student-profile-title">
              <span className="eyebrow">{student.code}</span>
              <h2>{student.nameArabic}</h2>
              <p>{student.nameEnglish || 'لا يوجد اسم إنجليزي'} · {student.branch.name}</p>
              <div className="profile-hero-meta"><span><Phone size={15} /> {student.phone || student.primaryGuardian?.primaryPhone || 'لا يوجد هاتف'}</span><span><BookOpen size={15} /> {[student.schoolName, student.gradeLevel].filter(Boolean).join(' · ') || 'غير محدد'}</span><span><CalendarDays size={15} /> مسجل منذ {dateText(student.registeredAt)}</span></div>
            </div>
            <div className="profile-hero-actions">
              <StatusPill active={student.status === 'ACTIVE'} activeText={statusLabels[student.status]} inactiveText={statusLabels[student.status]} />
              {can('students.change_status') ? <button className="secondary-action" onClick={() => setFormMode('status')}>تغيير الحالة</button> : null}
              {can('students.change_branch') ? <button className="secondary-action" onClick={() => setFormMode('branch')}>نقل الفرع</button> : null}
            </div>
          </header>

          <div className="profile-tabs">
            {([
              ['overview', 'نظرة عامة'], ['guardians', `أولياء الأمور (${student.guardians.length})`], ['pickups', `الاستلام (${student.authorizedPickups.length})`],
              ['documents', `المستندات (${student.documents.length})`], ['notes', `الملاحظات (${student.notes.length})`], ['cards', `الكروت (${student.cards.length})`], ['history', 'السجل'],
            ] as Array<[ProfileTab, string]>).map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}
          </div>

          {tab === 'overview' ? <StudentOverview student={student} /> : null}
          {tab === 'guardians' ? <ProfileGuardians student={student} canManage={can('guardians.link_students') && can('guardians.create')} onAdd={() => setFormMode('guardian')} /> : null}
          {tab === 'pickups' ? <ProfilePickups student={student} canManage={can('authorized_pickups.manage')} onAdd={() => setFormMode('pickup')} /> : null}
          {tab === 'documents' ? <ProfileDocuments student={student} canManage={can('students.manage_documents')} onAdd={() => setFormMode('document')} /> : null}
          {tab === 'notes' ? <ProfileNotes student={student} canManage={can('students.manage_notes')} onAdd={() => setFormMode('note')} /> : null}
          {tab === 'cards' ? <ProfileCards student={student} canIssue={can('smart_cards.issue')} onAdd={() => setFormMode('card')} /> : null}
          {tab === 'history' ? <ProfileHistory student={student} /> : null}
          {formError ? <div className="form-error">{formError}</div> : null}
        </div>
      ) : null}

      {student && formMode ? (
        <Modal title={profileFormTitle(formMode)} onClose={() => setFormMode(null)}>
          <form className="form-grid" onSubmit={(event) => void submitProfileForm(event)}>
            {formMode === 'note' ? <><Field label="التصنيف"><select name="category"><option value="GENERAL">عامة</option><option value="ACADEMIC">أكاديمية</option><option value="HEALTH">صحية</option><option value="BEHAVIOR">سلوكية</option><option value="FINANCIAL">مالية</option></select></Field><Field label="الملاحظة" full><textarea name="content" required /></Field><label className="checkbox-line full"><input type="checkbox" name="isSensitive" /> ملاحظة حساسة لا تظهر إلا للمصرح لهم</label></> : null}
            {formMode === 'document' ? <><Field label="نوع المستند"><select name="documentType"><option value="BIRTH_CERTIFICATE">شهادة ميلاد</option><option value="GUARDIAN_ID">هوية ولي الأمر</option><option value="MEDICAL_REPORT">تقرير طبي</option><option value="PHOTO">صورة</option><option value="OTHER">أخرى</option></select></Field><Field label="العنوان"><input name="title" required /></Field><Field label="الملف" full><input type="file" name="file" required /></Field><Field label="تاريخ الانتهاء"><input type="date" name="expiresAt" /></Field><label className="checkbox-line"><input type="checkbox" name="isSensitive" /> مستند حساس</label></> : null}
            {formMode === 'guardian' ? <><Field label="اسم ولي الأمر"><input name="nameArabic" required /></Field><Field label="الهاتف"><input name="primaryPhone" required /></Field><Field label="واتساب"><input name="whatsappPhone" /></Field><Field label="البريد"><input type="email" name="email" /></Field><Field label="صلة القرابة"><select name="relationship">{relationships.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="صلة أخرى"><input name="customRelationship" /></Field><label className="checkbox-line"><input type="checkbox" name="isPrimary" /> رئيسي</label><label className="checkbox-line"><input type="checkbox" name="isFinancialResponsible" /> مسؤول مالي</label><label className="checkbox-line"><input type="checkbox" name="receivesNotifications" defaultChecked /> يستقبل الإشعارات</label></> : null}
            {formMode === 'pickup' ? <><Field label="الاسم"><input name="nameArabic" required /></Field><Field label="الهاتف"><input name="phone" required /></Field><Field label="صلة القرابة"><select name="relationship">{relationships.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="صلة أخرى"><input name="customRelationship" /></Field><Field label="رقم الهوية"><input name="nationalId" /></Field><Field label="صالح حتى"><input type="date" name="validUntil" /></Field><Field label="ملاحظات أمنية" full><textarea name="securityNotes" /></Field></> : null}
            {formMode === 'status' ? <><Field label="الحالة الجديدة"><select name="status" defaultValue={student.status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="سبب التغيير"><textarea name="reason" /></Field></> : null}
            {formMode === 'branch' ? <><Field label="الفرع الجديد"><select name="branchId" defaultValue={student.branchId}>{branches.filter((branch) => branch.id !== student.branchId).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field><Field label="سبب النقل"><textarea name="reason" required /></Field></> : null}
            {formMode === 'card' ? <><Field label="طريقة الربط"><select name="cardAction"><option value="ISSUE">إصدار كارت جديد</option>{stockCards.length ? <option value="ASSIGN">ربط كارت من المخزون</option> : null}</select></Field><Field label="تصميم الكارت"><select name="templateId" required>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>{stockCards.length ? <Field label="كارت المخزون" full><select name="cardId">{stockCards.map((card) => <option key={card.id} value={card.id}>{card.publicCode} · {card.branch?.name || 'دون فرع'}</option>)}</select><small>يُستخدم فقط عند اختيار ربط كارت من المخزون.</small></Field> : null}</> : null}
            {formError ? <div className="form-error full">{formError}</div> : null}
            <div className="form-actions full"><button type="button" className="secondary-action" onClick={() => setFormMode(null)}>إلغاء</button><button className="primary-action" disabled={saving}>{saving ? 'جارٍ التنفيذ...' : 'حفظ'}</button></div>
          </form>
        </Modal>
      ) : null}
    </Modal>
  );
}

function StudentOverview({ student }: { student: StudentDetails }) {
  const fields = [
    ['النوع', student.gender === 'MALE' ? 'ذكر' : student.gender === 'FEMALE' ? 'أنثى' : 'غير محدد'],
    ['تاريخ الميلاد', dateText(student.birthDate)],
    ['الهاتف', student.phone || '—'], ['واتساب', student.whatsappPhone || '—'], ['العنوان', student.address || '—'],
    ['المدرسة', student.schoolName || '—'], ['الصف الحالي', student.gradeLevel || '—'], ['مصدر التسجيل', student.referralSource || '—'],
  ];
  return <div className="profile-overview"><div className="profile-field-grid">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="profile-notes-grid"><article><strong>ملاحظات صحية</strong><p>{student.healthNotes || 'لا توجد ملاحظات صحية مسجلة.'}</p></article><article><strong>ملاحظات إدارية</strong><p>{student.adminNotes || 'لا توجد ملاحظات إدارية مسجلة.'}</p></article></div></div>;
}

function ProfileGuardians({ student, canManage, onAdd }: { student: StudentDetails; canManage: boolean; onAdd: () => void }) {
  return <ProfileSection title="أولياء الأمور" action={canManage ? <button className="primary-action" onClick={onAdd}><Plus size={16} /> إضافة ولي أمر</button> : null}>{student.guardians.length ? student.guardians.map((link) => <article className="relation-record" key={`${link.guardian.id}-${link.createdAt}`}><div><strong>{link.guardian.nameArabic}</strong><span>{link.guardian.code} · {relationshipLabels[link.relationship]} · {link.guardian.primaryPhone}</span></div><div className="relation-flags">{link.isPrimary ? <span>رئيسي</span> : null}{link.isFinancialResponsible ? <span>مسؤول مالي</span> : null}{link.receivesNotifications ? <span>إشعارات</span> : null}{!link.isActive ? <span className="danger-text">منتهية</span> : null}</div></article>) : <EmptyState title="لا يوجد ولي أمر" description="أضف ولي الأمر الرئيسي وبيانات التواصل." />}</ProfileSection>;
}

function ProfilePickups({ student, canManage, onAdd }: { student: StudentDetails; canManage: boolean; onAdd: () => void }) {
  return <ProfileSection title="المصرح لهم بالاستلام" action={canManage ? <button className="primary-action" onClick={onAdd}><Plus size={16} /> إضافة تصريح</button> : null}>{student.authorizedPickups.length ? student.authorizedPickups.map((link) => <article className="relation-record" key={link.authorizedPickup.id}><div><strong>{link.authorizedPickup.nameArabic}</strong><span>{link.authorizedPickup.code} · {relationshipLabels[link.authorizedPickup.relationship]} · {link.authorizedPickup.phone}</span></div><div><StatusPill active={link.authorizedPickup.status === 'ACTIVE'} activeText="فعال" inactiveText={pickupStatusLabels[link.authorizedPickup.status]} /></div></article>) : <EmptyState title="لا توجد تصاريح استلام" description="سجّل الأشخاص المسموح لهم باستلام الطالب." />}</ProfileSection>;
}

function ProfileDocuments({ student, canManage, onAdd }: { student: StudentDetails; canManage: boolean; onAdd: () => void }) {
  async function download(document: StudentDocumentRow) {
    const blob = await requestBlob(`/students/${student.id}/documents/${document.id}/content`);
    downloadBlob(blob, document.fileName);
  }
  return <ProfileSection title="مستندات الطالب" action={canManage ? <button className="primary-action" onClick={onAdd}><Upload size={16} /> رفع مستند</button> : null}>{student.documents.length ? student.documents.map((document) => <article className="document-record" key={document.id}><FileText size={19} /><div><strong>{document.title}</strong><span>{document.fileName} · {Math.ceil(document.byteSize / 1024)} KB · {dateText(document.createdAt)}</span></div><button className="secondary-action" onClick={() => void download(document)}>تنزيل</button></article>) : <EmptyState title="لا توجد مستندات" description="يمكن رفع شهادة الميلاد والتقارير والصور المطلوبة." />}</ProfileSection>;
}

function ProfileNotes({ student, canManage, onAdd }: { student: StudentDetails; canManage: boolean; onAdd: () => void }) {
  return <ProfileSection title="الملاحظات" action={canManage ? <button className="primary-action" onClick={onAdd}><StickyNote size={16} /> إضافة ملاحظة</button> : null}>{student.notes.length ? student.notes.map((note) => <article className="note-record" key={note.id}><div><strong>{note.category}</strong><span>{note.createdBy.name} · {dateText(note.createdAt)} {note.isSensitive ? '· حساسة' : ''}</span></div><p>{note.content}</p></article>) : <EmptyState title="لا توجد ملاحظات" description="الملاحظات المسجلة تظهر هنا بترتيب زمني." />}</ProfileSection>;
}

function ProfileCards({ student, canIssue, onAdd }: { student: StudentDetails; canIssue: boolean; onAdd: () => void }) {
  return <ProfileSection title="الكروت الذكية" action={canIssue ? <button className="primary-action" onClick={onAdd}><CreditCard size={16} /> إصدار كارت</button> : null}>{student.cards.length ? student.cards.map((card) => <article className="relation-record" key={card.id}><div><strong>{card.publicCode}</strong><span>{card.subjectId || 'دون كود صاحب'} · {dateText(card.createdAt)}</span></div><StatusPill active={card.status === 'ACTIVE'} activeText="فعال" inactiveText={card.status} /></article>) : <EmptyState title="لا يوجد كارت مرتبط" description="أصدر كارتًا جديدًا أو اربط كارتًا من المخزون." />}</ProfileSection>;
}

function ProfileHistory({ student }: { student: StudentDetails }) {
  return <ProfileSection title="سجل حالة الطالب">{student.statusHistory.length ? <div className="profile-timeline">{student.statusHistory.map((entry) => <article key={entry.id}><span /><div><strong>{entry.fromStatus ? statusLabels[entry.fromStatus] : 'إنشاء الملف'} ← {statusLabels[entry.toStatus]}</strong><p>{entry.reason || 'دون سبب مسجل'}</p><small>{entry.changedBy.name} · {dateText(entry.changedAt)}</small></div></article>)}</div> : <EmptyState title="لا يوجد سجل" description="تغييرات الحالة ستظهر هنا." />}</ProfileSection>;
}

function GuardiansDirectory({ permissions }: { permissions: string[] }) {
  const [result, setResult] = useState<PagedResult<GuardianRow> | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<GuardianDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const canCreate = permissions.includes('guardians.create');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      request<PagedResult<GuardianRow>>(`/guardians?${buildQuery({ page: 1, pageSize: 50, search })}`)
        .then(setResult)
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل أولياء الأمور'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, version]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/guardians', { method: 'POST', body: JSON.stringify({ nameArabic: form.get('nameArabic'), nameEnglish: form.get('nameEnglish') || undefined, nationalId: form.get('nationalId') || undefined, primaryPhone: form.get('primaryPhone'), whatsappPhone: form.get('whatsappPhone') || undefined, email: form.get('email') || undefined, address: form.get('address') || undefined }) });
      setShowCreate(false); setVersion((value) => value + 1);
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'تعذر إنشاء ولي الأمر'); } finally { setSaving(false); }
  }

  async function openDetails(id: string) {
    try { setSelected(await request<GuardianDetails>(`/guardians/${id}`)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر فتح الملف'); }
  }

  return <>
    <div className="people-toolbar"><label className="directory-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم ولي الأمر أو الكود أو الهاتف..." /></label>{canCreate ? <button className="primary-action" onClick={() => setShowCreate(true)}><Plus size={17} /> إضافة ولي أمر</button> : null}</div>
    {loading ? <LoadingState /> : null}{error ? <ErrorState message={error} retry={() => setVersion((value) => value + 1)} /> : null}
    {!loading && !error ? <section className="guardian-directory">{result?.items.length ? result.items.map((guardian) => <article key={guardian.id}><div className="guardian-avatar"><UsersRound size={20} /></div><div><strong>{guardian.nameArabic}</strong><span>{guardian.code} · {guardian.primaryPhone}{guardian.email ? ` · ${guardian.email}` : ''}</span></div><div><strong>{guardian.studentsCount}</strong><span>طلاب مرتبطون</span></div><StatusPill active={guardian.status === 'ACTIVE'} activeText={guardianStatusLabels[guardian.status]} inactiveText={guardianStatusLabels[guardian.status]} /><button className="icon-button" onClick={() => void openDetails(guardian.id)}><Eye size={17} /></button></article>) : <EmptyState title="لا يوجد أولياء أمور" description="ابدأ بإضافة أول ملف ولي أمر." />}</section> : null}
    {showCreate ? <Modal title="إضافة ولي أمر" onClose={() => setShowCreate(false)}><form className="form-grid" onSubmit={(event) => void create(event)}><Field label="الاسم العربي"><input name="nameArabic" required /></Field><Field label="الاسم الإنجليزي"><input name="nameEnglish" /></Field><Field label="رقم الهوية"><input name="nationalId" /></Field><Field label="الهاتف الأساسي"><input name="primaryPhone" required /></Field><Field label="واتساب"><input name="whatsappPhone" /></Field><Field label="البريد"><input type="email" name="email" /></Field><Field label="العنوان" full><textarea name="address" /></Field>{formError ? <div className="form-error full">{formError}</div> : null}<div className="form-actions full"><button type="button" className="secondary-action" onClick={() => setShowCreate(false)}>إلغاء</button><button className="primary-action" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button></div></form></Modal> : null}
    {selected ? <Modal title={`${selected.nameArabic} — ${selected.code}`} onClose={() => setSelected(null)}><div className="guardian-details"><div className="profile-field-grid"><div><span>الهاتف</span><strong>{selected.primaryPhone}</strong></div><div><span>واتساب</span><strong>{selected.whatsappPhone || '—'}</strong></div><div><span>البريد</span><strong>{selected.email || '—'}</strong></div><div><span>العنوان</span><strong>{selected.address || '—'}</strong></div></div><ProfileSection title="الطلاب المرتبطون">{selected.students.length ? selected.students.map((link) => <article className="relation-record" key={link.student.id}><div><strong>{link.student.nameArabic}</strong><span>{link.student.code} · {link.student.branch.name}</span></div><span className="quiet-label">{relationshipLabels[link.relationship]}</span></article>) : <EmptyState title="لا توجد علاقات" description="لم يُربط ولي الأمر بأي طالب." />}</ProfileSection></div></Modal> : null}
  </>;
}

function PickupsDirectory() {
  const [result, setResult] = useState<PagedResult<AuthorizedPickupRow> | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      request<PagedResult<AuthorizedPickupRow>>(`/authorized-pickups?${buildQuery({ page: 1, pageSize: 50, search })}`)
        .then(setResult)
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل تصاريح الاستلام'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, version]);
  return <><div className="people-toolbar"><label className="directory-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم المصرح له أو الكود أو الهاتف..." /></label><span className="toolbar-note">تُضاف التصاريح من ملف الطالب لضمان الربط الصحيح.</span></div>{loading ? <LoadingState /> : null}{error ? <ErrorState message={error} retry={() => setVersion((value) => value + 1)} /> : null}{!loading && !error ? <section className="guardian-directory">{result?.items.length ? result.items.map((pickup) => <article key={pickup.id}><div className="guardian-avatar"><ShieldCheck size={20} /></div><div><strong>{pickup.nameArabic}</strong><span>{pickup.code} · {relationshipLabels[pickup.relationship]} · {pickup.phone}</span></div><div><strong>{pickup.studentsCount}</strong><span>طلاب مصرح بهم</span></div><StatusPill active={pickup.status === 'ACTIVE'} activeText="فعال" inactiveText={pickupStatusLabels[pickup.status]} /><span className="quiet-label">حتى {dateText(pickup.validUntil)}</span></article>) : <EmptyState title="لا توجد تصاريح استلام" description="افتح ملف الطالب ثم أضف الأشخاص المصرح لهم." />}</section> : null}</>;
}

function Field({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return <label className={`field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label>;
}

function RelationshipSelect({ value, onChange }: { value: GuardianRelationship; onChange: (value: GuardianRelationship) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value as GuardianRelationship)}>{relationships.map(([option, label]) => <option key={option} value={option}>{label}</option>)}</select>;
}

function ReviewBlock({ icon, title, lines }: { icon: ReactNode; title: string; lines: Array<string | undefined> }) {
  return <article><div className="review-icon">{icon}</div><div><strong>{title}</strong>{lines.filter(Boolean).map((line) => <span key={line}>{line}</span>)}</div></article>;
}

function ProfileSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="profile-section"><header><h3>{title}</h3>{action}</header><div>{children}</div></section>;
}

function profileFormTitle(mode: string) {
  const labels: Record<string, string> = { note: 'إضافة ملاحظة', document: 'رفع مستند', guardian: 'إضافة ولي أمر', pickup: 'إضافة تصريح استلام', status: 'تغيير حالة الطالب', branch: 'نقل الطالب إلى فرع', card: 'إصدار كارت طالب' };
  return labels[mode] ?? 'تنفيذ عملية';
}
