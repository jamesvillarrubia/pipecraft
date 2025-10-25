import { loggingFunction } from './logging';
describe('logging integration', () => {
  it('should integrate', () => { expect(loggingFunction()).toBeDefined(); });
});
