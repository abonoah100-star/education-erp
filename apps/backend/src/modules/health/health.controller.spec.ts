import { HealthController } from './health.controller';describe('HealthController',()=>{it('returns healthy status',()=>{expect(new HealthController().get().status).toBe('healthy');});});
