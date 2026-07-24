import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';

@Injectable()
export class CardSigningService {
  private signingSecret(): string {
    const secret = process.env.CARD_SIGNING_SECRET;
    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException('CARD_SIGNING_SECRET must contain at least 32 characters');
    }
    return secret;
  }

  payload(publicCode: string): string {
    const version = 'v1';
    const message = `${version}.${publicCode}`;
    const signature = createHmac('sha256', this.signingSecret())
      .update(message)
      .digest('base64url');
    return `educore:${version}:${publicCode}:${signature}`;
  }

  fingerprint(publicCode: string): string {
    return createHash('sha256').update(this.payload(publicCode)).digest('hex');
  }
}
