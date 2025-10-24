import { admin-dashboardFunction } from './admin-dashboard';
describe('admin-dashboard integration', () => {
  it('should integrate', () => { expect(admin-dashboardFunction()).toBeDefined(); });
});
