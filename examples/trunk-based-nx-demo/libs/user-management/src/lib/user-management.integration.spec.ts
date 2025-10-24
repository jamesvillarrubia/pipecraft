import { user-managementFunction } from './user-management';
describe('user-management integration', () => {
  it('should integrate', () => { expect(user-managementFunction()).toBeDefined(); });
});
