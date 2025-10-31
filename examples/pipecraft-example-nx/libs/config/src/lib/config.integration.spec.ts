import { configFunction } from './config'
describe('config integration', () => {
  it('should integrate', () => {
    expect(configFunction()).toBeDefined()
  })
})
