import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../core/prisma/prisma.service';

@Controller('branding')
export class BrandingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getBranding() {
    const organization = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        systemName: true,
        cardSubtitle: true,
        brandAsset: { select: { updatedAt: true } },
      },
    });
    if (!organization) {
      return {
        name: 'EduCore Learning Center',
        systemName: 'EduCore ERP',
        cardSubtitle: 'منصة إدارة مركز تعليمي',
        logoUrl: '/api/branding/logo',
        hasCustomLogo: false,
      };
    }
    return {
      name: organization.name,
      systemName: organization.systemName,
      cardSubtitle: organization.cardSubtitle,
      logoUrl: `/api/branding/logo?v=${organization.brandAsset?.updatedAt.getTime() ?? 'default'}`,
      hasCustomLogo: Boolean(organization.brandAsset),
    };
  }

  @Get('logo')
  async logo(@Res() response: Response) {
    const organization = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      select: {
        brandAsset: { select: { mimeType: true, content: true, updatedAt: true } },
      },
    });
    const asset = organization?.brandAsset;
    response.setHeader('Content-Type', asset?.mimeType ?? 'image/svg+xml; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(asset ? Buffer.from(asset.content) : Buffer.from(this.defaultLogoSvg()));
  }

  private defaultLogoSvg(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="logoBg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0F4B3B"/>
      <stop offset="1" stop-color="#082A22"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#logoBg)"/>
  <circle cx="256" cy="256" r="154" fill="#FFFFFF" opacity="0.96"/>
  <path d="M126 222 L256 156 L386 222 L256 288 Z" fill="#D9B56D"/>
  <path d="M178 274 C194 348 318 348 334 274 L334 348 C300 384 212 384 178 348 Z" fill="#0F4B3B"/>
  <path d="M363 240 V326" stroke="#D9B56D" stroke-width="18" stroke-linecap="round"/>
  <circle cx="363" cy="344" r="15" fill="#D9B56D"/>
</svg>`;
  }
}
