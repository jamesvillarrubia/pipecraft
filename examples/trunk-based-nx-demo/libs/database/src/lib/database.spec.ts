import { databaseFunction } from './database';
describe('database', () => {
  it('should work', () => { expect(databaseFunction()).toBe('database works!'); });
});
