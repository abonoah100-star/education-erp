# Sprint 2A — Smart Card Management

## الهدف

تقديم وحدة مستقلة للكروت الذكية تُنشئ الكارت والرموز من الكود، بدل الاعتماد على صور جاهزة أو إظهار payload خام.

## المخرجات

- Card templates لكل نوع صاحب كارت.
- QR موقّع باستخدام HMAC ولا يحتوي بيانات شخصية مباشرة.
- Code 128 باستخدام الرقم العام للكارت.
- صورة أمامية وخلفية للكارت بصيغة PNG أو SVG.
- صورة QR أو Barcode منفصلة قابلة للمشاركة والطباعة.
- مخزون كروت مطبوعة مسبقًا.
- Assign existing card workflow.
- A4 batch print sheets.
- Card lifecycle events and audit logs.

## قواعد الأمان

- لا يخرج `secretHash` أو `CARD_SIGNING_SECRET` في أي API response.
- QR يحتوي على `version + publicCode + signature` فقط.
- كل تنزيل صورة يحتاج JWT وصلاحية Backend.
- مدير الفرع لا يرى أو يطبع كروت فرع آخر.

## حدود Sprint 2A

ربط الكارت بكيان Student/Guardian/Teacher فعلي سيتم عند إنشاء تلك الوحدات. في هذه المرحلة يتم الربط بواسطة `subjectId` و`ownerName` مع الحفاظ على نموذج قابل لإضافة العلاقات الصريحة في Sprint الطلاب والمدرسين.
