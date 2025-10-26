import { authFunction } from './auth';
describe('auth integration', () => {
  it('should integrate', () => { expect(authFunction()).toBeDefined(); });
});
