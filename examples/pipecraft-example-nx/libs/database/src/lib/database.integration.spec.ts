import { databaseFunction } from './database'
describe('database integration', () => {
  it('should integrate', () => {
    expect(databaseFunction()).toBeDefined()
  })
})
