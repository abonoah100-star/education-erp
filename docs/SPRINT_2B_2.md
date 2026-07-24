# Sprint 2B.2 — Students & Guardians Backend

## الهدف

تحويل نطاق الطلاب وأولياء الأمور الذي أُنشئ في Sprint 2B.1 إلى Backend تشغيلي آمن، متعدد الفروع، ومتكامل مع الكروت الذكية.

## ما تم تنفيذه

### الطلاب

- إنشاء طالب داخل Transaction واحدة مع كود متسلسل على مستوى المؤسسة.
- إنشاء سجل أول لحالة الطالب عند التسجيل.
- قائمة طلاب مع Pagination والبحث والفلترة بالفرع والحالة والنوع والمدرسة والصف النصي الحالي.
- كشف حالات التكرار المحتملة بالاسم وتاريخ الميلاد والهوية وهواتف الطالب وولي الأمر.
- عرض ملف طالب كامل بعلاقات آمنة ومحددة الحقول.
- تعديل بيانات الطالب وتحديث اسم صاحب الكارت المرتبط.
- تغيير الحالة وفق سياسة انتقالات واضحة مع سجل تاريخي وAudit Log.
- نقل الطالب بين الفروع وتحديث فرع الكروت المرتبطة.

### أولياء الأمور

- إنشاء وتعديل واستعراض أولياء الأمور.
- ربط ولي الأمر بأكثر من طالب وربط الطالب بأكثر من ولي أمر.
- تحديد ولي الأمر الرئيسي والمسؤول المالي ومستقبل الإشعارات والمصرح له بالاستلام.
- حفظ تاريخ العلاقة عند إنهائها بدل حذفها.
- منع وجود أكثر من علاقة رئيسية أو مالية فعالة للطالب بواسطة قيود قاعدة البيانات.

### المصرح لهم بالاستلام

- إنشاء وتعديل المصرح له.
- ربطه بأكثر من طالب وإنهاء الربط دون حذف السجل.
- تواريخ صلاحية التصريح وملاحظاته الأمنية وحالته.
- صورة مستقلة للمصرح له.

### الصور والمستندات والملاحظات

- صور الطالب وولي الأمر والمصرح له مع معالجة موحدة وتخزين آمن.
- مستندات PDF/JPG/PNG/WebP بحد حجم واضح ومنع التكرار بالبصمة.
- عدم إظهار أو تنزيل المستندات الحساسة دون الصلاحية المناسبة.
- ملاحظات عامة وصحية وإدارية وأمنية مع دعم الحساسية.

### الكروت الذكية

- إصدار كارت طالب من ملفه مباشرة دون إعادة إدخال الاسم أو الفرع أو الكود.
- ربط كارت طالب موجود بالمخزون.
- مزامنة صورة الطالب مع صورة الكارت.
- منع وجود كارت حالي ثانٍ لنفس الطالب.

### الأمن والجودة

- عزل المؤسسة والفروع في جميع عمليات القراءة والكتابة.
- Response Selects تمنع خروج محتوى الملفات أو الحقول الداخلية.
- Audit Logs للعمليات الحساسة.
- معالجة موحدة لتعارضات القيود الفريدة.
- Migration لحفظ دورة حياة علاقة الطالب بولي الأمر.

## المسارات الرئيسية

```text
GET    /api/v1/students
GET    /api/v1/students/duplicates
POST   /api/v1/students
GET    /api/v1/students/:studentId
PATCH  /api/v1/students/:studentId
PATCH  /api/v1/students/:studentId/status
PATCH  /api/v1/students/:studentId/branch
POST   /api/v1/students/:studentId/photo
GET    /api/v1/students/:studentId/photo
GET    /api/v1/students/:studentId/documents
POST   /api/v1/students/:studentId/documents
GET    /api/v1/students/:studentId/documents/:documentId/content
GET    /api/v1/students/:studentId/notes
POST   /api/v1/students/:studentId/notes
POST   /api/v1/students/:studentId/cards/issue
POST   /api/v1/students/:studentId/cards/assign-existing

GET    /api/v1/guardians
POST   /api/v1/guardians
GET    /api/v1/guardians/:guardianId
PATCH  /api/v1/guardians/:guardianId
POST   /api/v1/guardians/:guardianId/photo
GET    /api/v1/guardians/:guardianId/photo
POST   /api/v1/guardians/link/student/:studentId
PATCH  /api/v1/guardians/:guardianId/students/:studentId
POST   /api/v1/guardians/:guardianId/students/:studentId/end

GET    /api/v1/authorized-pickups
POST   /api/v1/authorized-pickups
PATCH  /api/v1/authorized-pickups/:pickupId
POST   /api/v1/authorized-pickups/:pickupId/students
POST   /api/v1/authorized-pickups/:pickupId/students/:studentId/end
POST   /api/v1/authorized-pickups/:pickupId/photo
GET    /api/v1/authorized-pickups/:pickupId/photo
```

## ما ليس ضمن هذه المرحلة

- واجهات قائمة الطلاب ونموذج التسجيل وملف الطالب؛ تبدأ في Sprint 2B.3.
- الصفوف والمواد والكورسات والجداول الأكاديمية؛ تبدأ في Sprint 3.
- الاشتراكات والأسعار والدفع؛ تبدأ في Sprint 4.
