import { adminDashboardFunction } from './admin-dashboard';
describe('admin-dashboard integration', () => {
  it('should integrate', () => { expect(adminDashboardFunction()).toBeDefined(); });
});
