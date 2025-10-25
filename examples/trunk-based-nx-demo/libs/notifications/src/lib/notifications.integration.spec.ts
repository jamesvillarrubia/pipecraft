import { notificationsFunction } from './notifications';
describe('notifications integration', () => {
  it('should integrate', () => { expect(notificationsFunction()).toBeDefined(); });
});
