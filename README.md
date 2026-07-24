# Education ERP

ERP عربي متعدد الفروع لإدارة المراكز التعليمية.

## الإصدار الحالي

**Sprint 2A — Smart Card Management**

يتضمن:

- Authentication وRBAC.
- فروع وخزائن مستقلة.
- مستخدمين وأدوار وسجل مراجعة.
- تصميمات كروت متعددة للطالب وولي الأمر والمدرس والموظف.
- QR موقّع وCode 128.
- توليد صور PNG وSVG للكارت والرموز من الكود.
- مشاركة وتنزيل وطباعة الصور.
- مخزون كروت مطبوعة مسبقًا وربطها بأصحاب جدد.
- صفحات طباعة دفعية A4.

## القاعدة غير القابلة للتفاوض

لا تقبل حلول مؤقتة أو Workarounds أو تجاوزات للمعمارية. كل خلل يعالج من سببه الجذري ويُحمى باختبار أو قيد واضح.

راجع:

- `docs/PROJECT_CONSTITUTION.md`
- `docs/SPRINT_2A.md`

## Sprint 2A.2

Smart-card images now use Noto Kufi Arabic, database-backed sequential identifiers,
managed portrait assets, and a default student portrait when no image is selected.
See `docs/PROJECT_STATUS.md` for the complete handover and remaining roadmap.


## Sprint 2A.2.1

- إصلاح جذري لتخزين صور الكروت في Prisma `Bytes` تحت Node.js 22 وTypeScript.
- تحويل `Buffer` إلى `Uint8Array<ArrayBuffer>` عند حد التخزين دون Cast أو Workaround.
- إضافة اختبار Regression وتحديث ملف تسليم المشروع.

## Sprint 2A.3

الإصدار الحالي `2.3.0` يضيف:

- لوجو مؤسسة قابلًا للرفع من الإعدادات.
- لوجو افتراضي مولّد عند عدم رفع لوجو مخصص.
- استخدام اللوجو في تسجيل الدخول والقائمة الجانبية ووجهي الكارت.
- إعادة توزيع اسم صاحب الكارت والكود والفرع إلى يسار الصورة بتنسيق تشغيلي أوضح.
- Migration رسمية لأصل الهوية البصرية داخل PostgreSQL.

تفاصيل الاستكمال موجودة في `docs/PROJECT_STATUS.md`.

## Current delivery stage

Version `2.4.0` completes Sprint 2B.1: the students, guardians, authorized pickups,
documents, notes, status history and profile-sequence database foundation.
See `docs/PROJECT_STATUS.md` and `docs/SPRINT_2B_1.md` before continuing to Sprint 2B.2.
