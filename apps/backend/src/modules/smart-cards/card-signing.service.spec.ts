import { CardSigningService } from './card-signing.service';

describe('CardSigningService', () => {
  const previous = process.env.CARD_SIGNING_SECRET;

  beforeAll(() => {
    process.env.CARD_SIGNING_SECRET = 'a'.repeat(64);
  });

  afterAll(() => {
    process.env.CARD_SIGNING_SECRET = previous;
  });

  it('produces a deterministic signed payload without personal data', () => {
    const service = new CardSigningService();
    const payload = service.payload('EDU-STU-0001');

    expect(payload).toMatch(/^educore:v1:EDU-STU-0001:[A-Za-z0-9_-]+$/);
    expect(service.payload('EDU-STU-0001')).toBe(payload);
    expect(payload).not.toContain('طالب');
  });
});
