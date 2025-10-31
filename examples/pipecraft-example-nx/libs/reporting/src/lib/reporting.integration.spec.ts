import { reportingFunction } from './reporting'
describe('reporting integration', () => {
  it('should integrate', () => {
    expect(reportingFunction()).toBeDefined()
  })
})
