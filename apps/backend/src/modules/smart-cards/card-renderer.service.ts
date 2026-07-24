import { Injectable } from '@nestjs/common';
import type { BarcodeType, CardCodeFormat, CardType } from '@prisma/client';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import sharp, { type OverlayOptions } from 'sharp';

export type CardSide = 'front' | 'back';
export type CardSelection = CardSide | 'both';
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
  organizationSubtitle: string | null;
  cardBackTitle: string | null;
  cardBackInstruction: string | null;
  cardBackFooter: string | null;
  organizationLogo: {
    mimeType: string;
    content: Buffer;
  } | null;
  branchName: string | null;
  portrait: {
    mimeType: string;
    content: Buffer;
  } | null;
  template: {
    name: string;
    backgroundColor: string;
    accentColor: string;
    textColor: string;
    mutedTextColor: string;
    showPhoto: boolean;
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

const displayArabicFont = "'Noto Kufi Arabic', 'Noto Sans Arabic', 'DejaVu Sans', sans-serif";
const bodyArabicFont = "'Noto Sans Arabic', 'Noto Kufi Arabic', 'DejaVu Sans', sans-serif";
const codeFont = "'DejaVu Sans Mono', 'Liberation Mono', monospace";

@Injectable()
export class CardRendererService {
  async renderCard(input: RenderCardInput, side: CardSide, format: ImageFormat): Promise<Buffer> {
    const svg = side === 'front' ? await this.frontSvg(input) : await this.backSvg(input);
    return format === 'svg' ? Buffer.from(svg) : sharp(Buffer.from(svg)).png().toBuffer();
  }

  async renderSelection(
    input: RenderCardInput,
    selection: CardSelection,
    format: ImageFormat,
  ): Promise<Buffer> {
    if (selection !== 'both') return this.renderCard(input, selection, format);
    const front = await this.frontSvg(input);
    const back = await this.backSvg(input);
    const combined = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2062" height="638" viewBox="0 0 2062 638">
  <rect width="2062" height="638" fill="#FFFFFF"/>
  <g transform="translate(0 0)">${this.innerSvg(front)}</g>
  <g transform="translate(1051 0)">${this.innerSvg(back)}</g>
</svg>`;
    return format === 'svg' ? Buffer.from(combined) : sharp(Buffer.from(combined)).png().toBuffer();
  }

  async renderCode(kind: CodeImageKind, value: string, format: ImageFormat): Promise<Buffer> {
    const svg = kind === 'qr' ? await this.qrSvg(value) : this.barcodeSvg(value);
    return format === 'svg' ? Buffer.from(svg) : sharp(Buffer.from(svg)).png().toBuffer();
  }

  async normalizePortrait(input: Buffer): Promise<{ content: Buffer; mimeType: string }> {
    const content = await sharp(input)
      .rotate()
      .resize(720, 720, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer();
    return { content, mimeType: 'image/jpeg' };
  }

  async renderSheet(
    cards: RenderCardInput[],
    layoutName: 'SINGLE' | 'A4_8_UP' | 'A4_10_UP',
    side: CardSide,
  ): Promise<Buffer> {
    if (cards.length === 0) {
      return sharp({ create: { width: 1200, height: 800, channels: 4, background: '#ffffff' } })
        .png()
        .toBuffer();
    }
    if (layoutName === 'SINGLE') return this.renderCard(cards[0]!, side, 'png');

    const layout = this.sheetLayout(layoutName);
    const composites: OverlayOptions[] = [];
    const horizontalContent =
      layout.columns * layout.cardWidth + (layout.columns - 1) * layout.horizontalGap;
    const verticalContent = layout.rows * layout.cardHeight + (layout.rows - 1) * layout.verticalGap;
    const startX = Math.floor((layout.canvasWidth - horizontalContent) / 2);
    const startY = Math.floor((layout.canvasHeight - verticalContent) / 2);

    for (let index = 0; index < Math.min(cards.length, layout.columns * layout.rows); index += 1) {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      const card = await this.renderCard(cards[index]!, side, 'png');
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
    const portraitUri = input.portrait
      ? `data:${input.portrait.mimeType};base64,${input.portrait.content.toString('base64')}`
      : this.svgDataUri(this.defaultPortraitSvg(input.cardType, theme.background, theme.accent));
    const logoUri = input.organizationLogo
      ? `data:${input.organizationLogo.mimeType};base64,${input.organizationLogo.content.toString('base64')}`
      : this.svgDataUri(this.defaultLogoSvg(theme.background, theme.accent));
    const reference = input.subjectId ?? input.publicCode;
    const branch = input.template?.showBranch && input.branchName ? input.branchName : '';
    const expiry =
      input.template?.showExpiry && input.expiresAt
        ? `صالح حتى ${new Intl.DateTimeFormat('ar-EG').format(input.expiresAt)}`
        : '';
    const showQr = input.codeFormat !== 'BARCODE';
    const showBarcode = input.codeFormat !== 'QR';
    const showPhoto = input.template?.showPhoto ?? true;
    const name = this.nameLayout(input.ownerName ?? 'كارت غير مرتبط');
    const organization = this.fitText(input.organizationName, 30, 500);
    const subtitle = input.organizationSubtitle?.trim() || cardLabels[input.cardType];
    const dataCenterX = showPhoto ? 500 : 610;
    const dataPanelX = showPhoto ? 282 : 355;
    const dataPanelWidth = showPhoto ? 438 : 510;
    const portraitMarkup = showPhoto
      ? `<circle cx="852" cy="274" r="108" fill="#F8FAF9" stroke="${theme.accent}" stroke-width="8"/>
         <image href="${portraitUri}" x="756" y="178" width="192" height="192" preserveAspectRatio="xMidYMid slice" clip-path="url(#portraitClip)"/>
         <rect x="772" y="392" width="160" height="36" rx="18" fill="#081E18" opacity="0.72"/>
         <text x="852" y="416" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" fill="${theme.muted}" font-family="${bodyArabicFont}" font-size="15" font-weight="700">${this.escape(cardLabels[input.cardType])}</text>`
      : '';
    const qrX = showBarcode ? 56 : 421;
    const barcodeX = showQr ? 315 : 300;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1011" height="638" viewBox="0 0 1011 638">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${theme.background}"/>
      <stop offset="1" stop-color="${theme.deepBackground}"/>
    </linearGradient>
    <clipPath id="portraitClip"><circle cx="852" cy="274" r="96"/></clipPath>
    <clipPath id="logoClip"><rect x="50" y="42" width="86" height="86" rx="20"/></clipPath>
  </defs>
  <rect width="1011" height="638" rx="30" fill="url(#bg)"/>
  <path d="M0 500 C185 424 365 580 586 500 C770 432 892 392 1011 438 L1011 638 L0 638Z" fill="${theme.accent}" opacity="0.18"/>

  <rect x="46" y="38" width="94" height="94" rx="24" fill="#FFFFFF" opacity="0.96"/>
  <image href="${logoUri}" x="50" y="42" width="86" height="86" preserveAspectRatio="xMidYMid meet" clip-path="url(#logoClip)"/>
  <rect x="156" y="48" width="8" height="80" rx="4" fill="${theme.accent}"/>
  <text x="184" y="82" fill="${theme.text}" font-family="${displayArabicFont}" font-size="${organization.fontSize}" font-weight="700" ${organization.lengthAttribute}>${this.escape(input.organizationName)}</text>
  <text x="184" y="120" fill="${theme.muted}" font-family="${bodyArabicFont}" font-size="18" font-weight="500">${this.escape(subtitle)}</text>

  ${portraitMarkup}

  <g aria-label="بيانات صاحب الكارت">
    <rect x="${dataPanelX}" y="164" width="${dataPanelWidth}" height="250" rx="24" fill="#FFFFFF" opacity="0.055" stroke="${theme.accent}" stroke-opacity="0.28"/>
    <text x="${dataCenterX}" y="194" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" fill="${theme.muted}" font-family="${bodyArabicFont}" font-size="14" font-weight="700">بيانات صاحب الكارت</text>
    ${name.lines.map((line, index) => {
      const lineFit = this.fitText(line, name.fontSize, showPhoto ? 360 : 430);
      return `<text x="${dataCenterX}" y="${name.startY + index * name.lineHeight}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" fill="${theme.text}" font-family="${displayArabicFont}" font-size="${lineFit.fontSize}" font-weight="700" ${lineFit.lengthAttribute}>${this.escape(line)}</text>`;
    }).join('')}
    <line x1="${dataPanelX + 46}" y1="${name.detailsY - 26}" x2="${dataPanelX + dataPanelWidth - 46}" y2="${name.detailsY - 26}" stroke="${theme.accent}" stroke-opacity="0.42"/>
    <rect x="${dataCenterX - 162}" y="${name.detailsY - 13}" width="324" height="42" rx="21" fill="#071C17" opacity="0.68"/>
    <text x="${dataCenterX}" y="${name.detailsY + 14}" text-anchor="middle" fill="${theme.text}" font-family="${codeFont}" font-size="18" font-weight="700" letter-spacing="0.5">${this.escape(reference)}</text>
    ${branch ? `<text x="${dataCenterX}" y="${name.detailsY + 62}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" fill="${theme.text}" font-family="${displayArabicFont}" font-size="17" font-weight="600">${this.escape(branch)}</text>` : ''}
    ${expiry ? `<text x="${dataCenterX}" y="${name.detailsY + 92}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" fill="${theme.muted}" font-family="${bodyArabicFont}" font-size="14">${this.escape(expiry)}</text>` : ''}
  </g>

  ${showQr ? `<rect x="${qrX}" y="420" width="180" height="180" rx="18" fill="#FFFFFF"/><image href="${qrUri}" x="${qrX + 12}" y="432" width="156" height="156"/>` : ''}
  ${showBarcode ? `<rect x="${barcodeX}" y="478" width="410" height="82" rx="12" fill="#FFFFFF"/><image href="${barcodeUri}" x="${barcodeX + 16}" y="490" width="378" height="54"/>` : ''}
  ${showBarcode ? `<text x="${barcodeX + 205}" y="590" text-anchor="middle" fill="${theme.muted}" font-family="${codeFont}" font-size="16" font-weight="700" letter-spacing="0.8">${this.escape(input.publicCode)}</text>` : `<text x="${qrX + 90}" y="622" text-anchor="middle" fill="${theme.muted}" font-family="${codeFont}" font-size="16" font-weight="700" letter-spacing="0.8">${this.escape(input.publicCode)}</text>`}
</svg>`;
  }

  private async backSvg(input: RenderCardInput): Promise<string> {
    const theme = this.theme(input);
    const qr = await this.qrSvg(input.qrPayload);
    const qrUri = this.svgDataUri(qr);
    const logoUri = input.organizationLogo
      ? `data:${input.organizationLogo.mimeType};base64,${input.organizationLogo.content.toString('base64')}`
      : this.svgDataUri(this.defaultLogoSvg(theme.background, theme.accent));
    const title = input.cardBackTitle?.trim() || `هذه البطاقة ملك ${input.organizationName}`;
    const instruction =
      input.cardBackInstruction?.trim() || 'عند العثور عليها يرجى تسليمها إلى أقرب فرع';
    const footer = input.cardBackFooter?.trim() || '';
    const titleLines = this.wrapText(title, 35, 2);
    const instructionLines = this.wrapText(instruction, 48, 2);
    const footerLines = footer ? this.wrapText(footer, 58, 2) : [];

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1011" height="638" viewBox="0 0 1011 638">
  <rect width="1011" height="638" rx="30" fill="${theme.deepBackground}"/>
  <rect x="0" y="90" width="1011" height="98" fill="#0A1411" opacity="0.85"/>
  <rect x="458" y="34" width="94" height="94" rx="24" fill="#FFFFFF" opacity="0.96"/>
  <image href="${logoUri}" x="464" y="40" width="82" height="82" preserveAspectRatio="xMidYMid meet"/>
  ${titleLines.map((line, index) => {
    const fitted = this.fitText(line, 28, 820);
    return `<text x="505" y="${240 + index * 39}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" fill="${theme.text}" font-family="${displayArabicFont}" font-size="${fitted.fontSize}" font-weight="700" ${fitted.lengthAttribute}>${this.escape(line)}</text>`;
  }).join('')}
  ${instructionLines.map((line, index) => {
    const fitted = this.fitText(line, 19, 820);
    return `<text x="505" y="${326 + index * 30}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" fill="${theme.muted}" font-family="${bodyArabicFont}" font-size="${fitted.fontSize}" font-weight="500" ${fitted.lengthAttribute}>${this.escape(line)}</text>`;
  }).join('')}
  <rect x="421" y="380" width="168" height="168" rx="16" fill="#FFFFFF"/>
  <image href="${qrUri}" x="433" y="392" width="144" height="144"/>
  ${footerLines.map((line, index) => {
    const fitted = this.fitText(line, 15, 850);
    return `<text x="505" y="${575 + index * 22}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" fill="${theme.muted}" font-family="${bodyArabicFont}" font-size="${fitted.fontSize}" ${fitted.lengthAttribute}>${this.escape(line)}</text>`;
  }).join('')}
  <text x="505" y="625" text-anchor="middle" fill="${theme.muted}" font-family="${codeFont}" font-size="15" font-weight="600">${this.escape(input.publicCode)}</text>
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

  private nameLayout(value: string) {
    const clean = value.trim().replace(/\s+/gu, ' ');
    const words = clean.split(' ').filter(Boolean);
    if (clean.length <= 19) {
      return {
        lines: [clean],
        fontSize: 31,
        startY: 256,
        lineHeight: 42,
        detailsY: 315,
      };
    }

    let bestIndex = 1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let index = 1; index < words.length; index += 1) {
      const first = words.slice(0, index).join(' ');
      const second = words.slice(index).join(' ');
      const delta = Math.abs(first.length - second.length);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = index;
      }
    }
    const lines = [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')];
    const longest = Math.max(...lines.map((line) => line.length));
    const fontSize = longest > 26 ? 23 : longest > 21 ? 26 : 28;
    return {
      lines,
      fontSize,
      startY: 232,
      lineHeight: 42,
      detailsY: 330,
    };
  }

  private wrapText(value: string, maxCharacters: number, maxLines: number): string[] {
    const words = value.trim().replace(/\s+/gu, ' ').split(' ').filter(Boolean);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxCharacters || current.length === 0) {
        current = candidate;
        continue;
      }
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
    if (current && lines.length < maxLines) lines.push(current);

    const consumedWords = lines.join(' ').split(' ').length;
    if (consumedWords < words.length && lines.length > 0) {
      const lastIndex = lines.length - 1;
      const last = lines[lastIndex] ?? '';
      lines[lastIndex] = `${last.replace(/[.،؛:!?…]+$/u, '')}…`;
    }
    return lines.length > 0 ? lines : [value.trim()];
  }

  private fitText(value: string, fontSize: number, maxWidth: number) {
    const estimatedWidth = value.length * fontSize * 0.64;
    const adjusted =
      estimatedWidth > maxWidth
        ? Math.max(Math.min(18, fontSize), Math.floor(fontSize * (maxWidth / estimatedWidth)))
        : fontSize;
    return {
      fontSize: adjusted,
      lengthAttribute:
        estimatedWidth > maxWidth ? `textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '',
    };
  }

  private defaultPortraitSvg(cardType: CardType, background: string, accent: string): string {
    const studentCap = cardType === 'STUDENT'
      ? `<path d="M42 57 L90 34 L138 57 L90 80 Z" fill="${accent}"/><path d="M127 62 V92" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`
      : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#EEF3F1"/>
  <circle cx="90" cy="76" r="36" fill="${background}" opacity="0.88"/>
  <path d="M28 178 C33 126 56 107 90 107 C124 107 147 126 152 178 Z" fill="${background}" opacity="0.92"/>
  ${studentCap}
</svg>`;
  }

  private defaultLogoSvg(background: string, accent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="120" fill="${background}"/>
  <circle cx="256" cy="256" r="168" fill="#FFFFFF" opacity="0.97"/>
  <path d="M126 222 L256 156 L386 222 L256 288 Z" fill="${accent}"/>
  <path d="M178 274 C194 348 318 348 334 274 L334 348 C300 384 212 384 178 348 Z" fill="${background}"/>
  <path d="M363 240 V326" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
  <circle cx="363" cy="344" r="15" fill="${accent}"/>
</svg>`;
  }

  private darken(color: string): string {
    const hex = color.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#071F19';
    const values = [0, 2, 4].map((offset) =>
      Math.max(0, Math.round(Number.parseInt(hex.slice(offset, offset + 2), 16) * 0.62)),
    );
    return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
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

  private innerSvg(svg: string): string {
    return svg
      .replace(/^<\?xml[^>]*>\s*/u, '')
      .replace(/^<svg[^>]*>/u, '')
      .replace(/<\/svg>\s*$/u, '');
  }
}
