import { billingFunction } from './billing'
describe('billing integration', () => {
  it('should integrate', () => {
    expect(billingFunction()).toBeDefined()
  })
})
