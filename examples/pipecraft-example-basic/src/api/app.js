/**
 * API Gateway Domain
 *
 * This is placeholder code demonstrating an API gateway service.
 * Used to test PipeCraft's domain detection and testing workflows.
 */

console.log('API Gateway domain loaded');

// API Gateway routing
function createGateway() {
  return {
    route: (service, path) => {
      console.log(`Routing to ${service}${path}`);
      return Promise.resolve({ service, path, status: 'routed' });
    },
    authenticate: (token) => {
      console.log('Authenticating request');
      return token === 'valid-token';
    },
    rateLimit: (clientId) => {
      console.log(`Checking rate limit for ${clientId}`);
      return { allowed: true, remaining: 100 };
    }
  };
}

// Service discovery
function discoverServices() {
  return Promise.resolve([
    { name: 'backend', url: 'http://backend:3000' },
    { name: 'frontend', url: 'http://frontend:8080' }
  ]);
}

export { createGateway, discoverServices };
