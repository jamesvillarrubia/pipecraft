import { notificationsFunction } from './notifications'
describe('notifications', () => {
  it('should work', () => {
    expect(notificationsFunction()).toBe('notifications works!')
  })
})
