import { authFunction } from './auth'
describe('auth', () => {
  it('should work', () => {
    expect(authFunction()).toBe('auth works!')
  })
})
