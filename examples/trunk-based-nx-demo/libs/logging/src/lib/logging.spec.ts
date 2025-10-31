import { loggingFunction } from './logging'
describe('logging', () => {
  it('should work', () => {
    expect(loggingFunction()).toBe('logging works!')
  })
})
