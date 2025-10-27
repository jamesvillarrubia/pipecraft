/**
 * Backend Domain - FAKE CODE
 * 
 * This is completely fake code that does nothing.
 * Used to test PipeCraft's domain detection and testing workflows.
 */

console.log('Backend domain loaded (fake)');

// Fake Express server
function createFakeServer() {
  return {
    listen: () => console.log('Fake server listening'),
    get: () => console.log('Fake GET route'),
    post: () => console.log('Fake POST route')
  };
}

// Fake database connection
function connectToFakeDatabase() {
  return Promise.resolve('Fake database connected');
}

module.exports = {
  createFakeServer,
  connectToFakeDatabase
};
