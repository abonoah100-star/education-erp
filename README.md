# Education ERP

ERP عربي متعدد الفروع لإدارة المراكز التعليمية.

## الإصدار الحالي

**Sprint 2B.2 — Students & Guardians Backend**

يتضمن:

- Authentication وRBAC وعزل الفروع.
- فروع وخزائن مستقلة وسجل مراجعة.
- إدارة الكروت الذكية والصور والطباعة.
- إنشاء وبحث وتعديل ونقل وإيقاف ملفات الطلاب.
- إدارة أولياء الأمور وعلاقاتهم التاريخية بالطلاب.
- إدارة المصرح لهم بالاستلام وصلاحية التصريح.
- صور الطلاب والأولياء والمصرح لهم.
- مستندات وملاحظات الطالب مع حماية المحتوى الحساس.
- إصدار كارت طالب أو ربط كارت جاهز من المخزون.

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


## Sprint 2B.2

- Backend تشغيلي كامل للطلاب وأولياء الأمور والمصرح لهم بالاستلام.
- أكواد ملفات ذرية ومتسلسلة لكل مؤسسة.
- Pagination والبحث والفلترة واكتشاف التكرار المحتمل.
- حفظ تاريخ علاقات ولي الأمر بدل الحذف.
- عزل بيانات الفروع في الاستعلامات والملفات والصور والكروت.
- تكامل مباشر مع وحدة الكروت الذكية.

راجع `docs/PROJECT_STATUS.md` لمعرفة ما تم وما تبقى.

## Sprint 2B.3 — Students and Guardians UI

The operational workspace now includes a dedicated Students & Guardians module with:

- Student directory, search, branch/status filters, and pagination.
- Multi-step registration with duplicate review.
- Guardians and authorized-pickup capture.
- Protected student photos and document uploads.
- Student profile timeline, notes, documents, cards, and relations.
- Smart-card issue or inventory assignment from the real student profile.

See `docs/SPRINT_2B_3.md` and `docs/PROJECT_STATUS.md`.
