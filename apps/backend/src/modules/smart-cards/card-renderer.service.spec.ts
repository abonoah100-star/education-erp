import type { CardType } from '@prisma/client';
import { CardRendererService, type RenderCardInput } from './card-renderer.service';

function createInput(): RenderCardInput {
  return {
    publicCode: 'EDU-STU-000001',
    cardType: 'STUDENT' as CardType,
    ownerName: 'أحمد محمد عبد الرحمن علي',
    subjectId: 'STU-000001',
    expiresAt: null,
    codeFormat: 'QR_AND_BARCODE',
    barcodeType: 'CODE128',
    qrPayload: 'educore:v1:EDU-STU-000001:signature',
    organizationName: 'مركز التعليم المتكامل',
    organizationSubtitle: 'منصة الإدارة التعليمية',
    cardBackTitle: 'هذه البطاقة ملك مركز التعليم المتكامل',
    cardBackInstruction: 'عند العثور عليها يرجى تسليمها إلى أقرب فرع',
    cardBackFooter: 'يرجى المحافظة على البطاقة وعدم مشاركتها مع الغير',
    organizationLogo: null,
    branchName: 'الفرع الرئيسي',
    portrait: null,
    template: {
      name: 'الطالب — الزمرد',
      backgroundColor: '#0F4B3B',
      accentColor: '#D9B56D',
      textColor: '#FFFFFF',
      mutedTextColor: '#DCEAE5',
      showPhoto: true,
      showBranch: true,
      showExpiry: false,
    },
  };
}

describe('CardRendererService', () => {
  it('uses a fixed data panel that cannot overlap the portrait or code area', async () => {
    const service = new CardRendererService();
    const svg = (await service.renderCard(createInput(), 'front', 'svg')).toString('utf8');

    expect(svg).toContain('Noto Kufi Arabic');
    expect(svg).toContain('clip-path="url(#portraitClip)"');
    expect(svg).toContain('x="282" y="164" width="438" height="250"');
    expect(svg).toContain('cx="852" cy="274" r="108"');
    expect(svg).toContain('x="315" y="478" width="410" height="82"');
    expect(svg).toContain('بيانات صاحب الكارت');
    expect(svg).toContain('الفرع الرئيسي');
    expect(svg).toContain('EDU-STU-000001');
  });

  it('renders the editable back-card title, instruction and footer', async () => {
    const service = new CardRendererService();
    const svg = (await service.renderCard(createInput(), 'back', 'svg')).toString('utf8');

    expect(svg).toContain('هذه البطاقة ملك مركز التعليم المتكامل');
    expect(svg).toContain('عند العثور عليها يرجى تسليمها إلى أقرب فرع');
    expect(svg).toContain('يرجى المحافظة على البطاقة وعدم مشاركتها مع الغير');
  });
});
