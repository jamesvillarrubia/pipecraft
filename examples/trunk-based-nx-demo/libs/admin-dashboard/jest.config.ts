export default {
  displayName: 'admin-dashboard',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {'^.+\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]},
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../coverage/libs/admin-dashboard'
};
