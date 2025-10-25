import { analyticsFunction } from './analytics';
describe('analytics integration', () => {
  it('should integrate', () => { expect(analyticsFunction()).toBeDefined(); });
});
