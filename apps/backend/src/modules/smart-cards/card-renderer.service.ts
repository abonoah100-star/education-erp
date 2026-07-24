import { Injectable } from '@nestjs/common';
import type { BarcodeType, CardCodeFormat, CardType } from '@prisma/client';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import sharp, { type OverlayOptions } from 'sharp';

export type CardSide = 'front' | 'back';
export type ImageFormat = 'png' | 'svg';
export type CodeImageKind = 'qr' | 'barcode';

export interface RenderCardInput {
  publicCode: string;
  cardType: CardType;
  ownerName: string | null;
  subjectId: string | null;
  expiresAt: Date | null;
  codeFormat: CardCodeFormat;
  barcodeType: BarcodeType;
  qrPayload: string;
  organizationName: string;
  branchName: string | null;
  template: {
    name: string;
    backgroundColor: string;
    accentColor: string;
    textColor: string;
    mutedTextColor: string;
    showBranch: boolean;
    showExpiry: boolean;
  } | null;
}

interface SheetLayout {
  canvasWidth: number;
  canvasHeight: number;
  columns: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  horizontalGap: number;
  verticalGap: number;
}

const cardLabels: Record<CardType, string> = {
  STUDENT: 'بطاقة طالب',
  GUARDIAN: 'بطاقة ولي أمر',
  TEACHER: 'بطاقة مدرس',
  STAFF: 'بطاقة موظف',
};

@Injectable()
export class CardRendererService {
  async renderCard(input: RenderCardInput, side: CardSide, format: ImageFormat): Promise<Buffer> {
    const svg = side === 'front' ? await this.frontSvg(input) : await this.backSvg(input);
    return format === 'svg' ? Buffer.from(svg) : sharp(Buffer.from(svg)).png().toBuffer();
  }

  async renderCode(
    kind: CodeImageKind,
    value: string,
    format: ImageFormat,
  ): Promise<Buffer> {
    const svg = kind === 'qr' ? await this.qrSvg(value) : this.barcodeSvg(value);
    return format === 'svg' ? Buffer.from(svg) : sharp(Buffer.from(svg)).png().toBuffer();
  }

  async renderSheet(cards: RenderCardInput[], layoutName: 'SINGLE' | 'A4_8_UP' | 'A4_10_UP'): Promise<Buffer> {
    if (cards.length === 0) return sharp({ create: { width: 1200, height: 800, channels: 4, background: '#ffffff' } }).png().toBuffer();
    if (layoutName === 'SINGLE') return this.renderCard(cards[0]!, 'front', 'png');

    const layout = this.sheetLayout(layoutName);
    const composites: OverlayOptions[] = [];
    const horizontalContent = layout.columns * layout.cardWidth + (layout.columns - 1) * layout.horizontalGap;
    const verticalContent = layout.rows * layout.cardHeight + (layout.rows - 1) * layout.verticalGap;
    const startX = Math.floor((layout.canvasWidth - horizontalContent) / 2);
    const startY = Math.floor((layout.canvasHeight - verticalContent) / 2);

    for (let index = 0; index < Math.min(cards.length, layout.columns * layout.rows); index += 1) {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      const card = await this.renderCard(cards[index]!, 'front', 'png');
      const resized = await sharp(card)
        .resize(layout.cardWidth, layout.cardHeight, { fit: 'fill' })
        .png()
        .toBuffer();
      composites.push({
        input: resized,
        left: startX + column * (layout.cardWidth + layout.horizontalGap),
        top: startY + row * (layout.cardHeight + layout.verticalGap),
      });
    }

    return sharp({
      create: {
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        channels: 4,
        background: '#ffffff',
      },
    })
      .composite(composites)
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  private async frontSvg(input: RenderCardInput): Promise<string> {
    const theme = this.theme(input);
    const qr = await this.qrSvg(input.qrPayload);
    const barcode = this.barcodeSvg(input.publicCode);
    const qrUri = this.svgDataUri(qr);
    const barcodeUri = this.svgDataUri(barcode);
    const ownerName = this.escape(input.ownerName ?? 'كارت غير مرتبط');
    const reference = this.escape(input.subjectId ?? input.publicCode);
    const branch = input.template?.showBranch && input.branchName ? this.escape(input.branchName) : '';
    const expiry = input.template?.showExpiry && input.expiresAt
      ? `صالح حتى ${new Intl.DateTimeFormat('ar-EG').format(input.expiresAt)}`
      : '';
    const showQr = input.codeFormat !== 'BARCODE';
    const showBarcode = input.codeFormat !== 'QR';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1011" height="638" viewBox="0 0 1011 638">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${theme.background}"/>
      <stop offset="1" stop-color="${theme.deepBackground}"/>
    </linearGradient>
    <clipPath id="photoClip"><circle cx="835" cy="244" r="92"/></clipPath>
  </defs>
  <rect width="1011" height="638" rx="30" fill="url(#bg)"/>
  <path d="M0 485 C220 405 380 585 610 488 C760 425 860 360 1011 410 L1011 638 L0 638Z" fill="${theme.accent}" opacity="0.18"/>
  <rect x="52" y="48" width="10" height="90" rx="5" fill="${theme.accent}"/>
  <text x="84" y="82" fill="${theme.text}" font-family="DejaVu Sans, sans-serif" font-size="31" font-weight="700">${this.escape(input.organizationName)}</text>
  <text x="84" y="121" fill="${theme.muted}" font-family="DejaVu Sans, sans-serif" font-size="20">${this.escape(cardLabels[input.cardType])}</text>
  <circle cx="835" cy="244" r="102" fill="none" stroke="${theme.accent}" stroke-width="8" opacity="0.95"/>
  <circle cx="835" cy="244" r="92" fill="#F1F5F4"/>
  <text x="835" y="267" text-anchor="middle" fill="${theme.background}" font-family="DejaVu Sans, sans-serif" font-size="72" font-weight="800">${this.initials(input.ownerName)}</text>
  <text x="690" y="386" text-anchor="end" direction="rtl" fill="${theme.text}" font-family="DejaVu Sans, sans-serif" font-size="42" font-weight="800">${ownerName}</text>
  <text x="690" y="428" text-anchor="end" direction="rtl" fill="${theme.muted}" font-family="DejaVu Sans, sans-serif" font-size="21">${reference}</text>
  ${branch ? `<text x="690" y="462" text-anchor="end" direction="rtl" fill="${theme.muted}" font-family="DejaVu Sans, sans-serif" font-size="18">${branch}</text>` : ''}
  ${expiry ? `<text x="690" y="494" text-anchor="end" direction="rtl" fill="${theme.muted}" font-family="DejaVu Sans, sans-serif" font-size="17">${this.escape(expiry)}</text>` : ''}
  ${showQr ? `<rect x="70" y="332" width="190" height="190" rx="16" fill="#FFFFFF"/><image href="${qrUri}" x="82" y="344" width="166" height="166"/>` : ''}
  ${showBarcode ? `<rect x="292" y="474" width="380" height="80" rx="10" fill="#FFFFFF"/><image href="${barcodeUri}" x="306" y="486" width="352" height="54"/>` : ''}
  <text x="690" y="586" text-anchor="end" fill="${theme.muted}" font-family="DejaVu Sans, sans-serif" font-size="17" letter-spacing="1">${this.escape(input.publicCode)}</text>
</svg>`;
  }

  private async backSvg(input: RenderCardInput): Promise<string> {
    const theme = this.theme(input);
    const qr = await this.qrSvg(input.qrPayload);
    const qrUri = this.svgDataUri(qr);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1011" height="638" viewBox="0 0 1011 638">
  <rect width="1011" height="638" rx="30" fill="${theme.deepBackground}"/>
  <rect x="0" y="90" width="1011" height="98" fill="#0A1411" opacity="0.85"/>
  <text x="505" y="268" text-anchor="middle" direction="rtl" fill="${theme.text}" font-family="DejaVu Sans, sans-serif" font-size="30" font-weight="700">هذه البطاقة ملك ${this.escape(input.organizationName)}</text>
  <text x="505" y="315" text-anchor="middle" direction="rtl" fill="${theme.muted}" font-family="DejaVu Sans, sans-serif" font-size="20">عند العثور عليها يرجى تسليمها إلى أقرب فرع</text>
  <rect x="420" y="355" width="170" height="170" rx="16" fill="#FFFFFF"/>
  <image href="${qrUri}" x="432" y="367" width="146" height="146"/>
  <text x="505" y="570" text-anchor="middle" fill="${theme.muted}" font-family="DejaVu Sans, sans-serif" font-size="18">${this.escape(input.publicCode)}</text>
</svg>`;
  }

  private async qrSvg(value: string): Promise<string> {
    return QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 0,
      color: { dark: '#10251F', light: '#FFFFFF' },
      width: 512,
    });
  }

  private barcodeSvg(value: string): string {
    return bwipjs.toSVG({
      bcid: 'code128',
      text: value,
      scale: 3,
      height: 12,
      includetext: false,
      backgroundcolor: 'FFFFFF',
      barcolor: '10251F',
      paddingwidth: 0,
      paddingheight: 0,
    });
  }

  private sheetLayout(layout: 'A4_8_UP' | 'A4_10_UP'): SheetLayout {
    return layout === 'A4_10_UP'
      ? {
          canvasWidth: 2480,
          canvasHeight: 3508,
          columns: 2,
          rows: 5,
          cardWidth: 900,
          cardHeight: 568,
          horizontalGap: 90,
          verticalGap: 38,
        }
      : {
          canvasWidth: 2480,
          canvasHeight: 3508,
          columns: 2,
          rows: 4,
          cardWidth: 1011,
          cardHeight: 638,
          horizontalGap: 90,
          verticalGap: 55,
        };
  }

  private theme(input: RenderCardInput) {
    const background = input.template?.backgroundColor ?? '#0F3D32';
    return {
      background,
      deepBackground: this.darken(background),
      accent: input.template?.accentColor ?? '#D9B56D',
      text: input.template?.textColor ?? '#FFFFFF',
      muted: input.template?.mutedTextColor ?? '#DDE8E4',
    };
  }

  private darken(color: string): string {
    const hex = color.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#071F19';
    const values = [0, 2, 4].map((offset) => Math.max(0, Math.round(Number.parseInt(hex.slice(offset, offset + 2), 16) * 0.62)));
    return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  private initials(name: string | null): string {
    if (!name) return 'ID';
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || 'ID';
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }

  private svgDataUri(svg: string): string {
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
}
