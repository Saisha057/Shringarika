/**
 * Load Testing Script for Shringarika API
 * 
 * Tests: 100 concurrent users for 5 minutes
 * 
 * Installation:
 *   npm install -g k6
 * 
 * Usage:
 *   k6 run load-test.k6.js
 *   k6 run --vus 100 --duration 5m load-test.k6.js
 *   k6 run --vus 200 --duration 10m load-test.k6.js
 * 
 * Scenarios:
 *   1. Homepage browsing (50%)
 *   2. Product browsing (30%)
 *   3. Search (10%)
 *   4. Checkout (10%)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:5000';

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users (target load)
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 50 },   // Ramp down to 50 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],                  // Error rate < 1%
    errors: ['rate<0.01'],                           // Custom error rate < 1%
  },
};

// Test data
const testProducts = [
  '123e4567-e89b-12d3-a456-426614174000',
  '123e4567-e89b-12d3-a456-426614174001',
  '123e4567-e89b-12d3-a456-426614174002',
];

const testCategories = [
  'suits',
  'sarees',
  'lehengas',
  'kurtis',
];

const searchQueries = [
  'red suit',
  'wedding lehenga',
  'party wear',
  'ethnic wear',
];

export default function () {
  // Simulate different user behaviors
  const scenario = Math.random();
  
  if (scenario < 0.5) {
    // 50% - Browse homepage and products
    browseHomepage();
  } else if (scenario < 0.8) {
    // 30% - Browse specific category
    browseCategory();
  } else if (scenario < 0.9) {
    // 10% - Search for products
    searchProducts();
  } else {
    // 10% - Complete checkout flow
    checkoutFlow();
  }
  
  sleep(1); // Think time between requests
}

function browseHomepage() {
  group('Browse Homepage', () => {
    // Health check
    let res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    
    // Get featured products
    res = http.get(`${BASE_URL}/api/products?featured=true&limit=10`);
    check(res, {
      'products API status 200': (r) => r.status === 200,
      'products loaded': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && Array.isArray(body.data.products);
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
    
    apiResponseTime.add(res.timings.duration);
    res.status === 200 ? successfulRequests.add(1) : failedRequests.add(1);
    
    sleep(2);
    
    // Get categories
    res = http.get(`${BASE_URL}/api/products/categories`);
    check(res, {
      'categories API status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    
    apiResponseTime.add(res.timings.duration);
  });
}

function browseCategory() {
  group('Browse Category', () => {
    const category = testCategories[Math.floor(Math.random() * testCategories.length)];
    
    // Get products in category
    const res = http.get(`${BASE_URL}/api/products?category=${category}&page=1&limit=20`);
    check(res, {
      'category products status 200': (r) => r.status === 200,
      'category has products': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.products && body.data.products.length > 0;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
    
    apiResponseTime.add(res.timings.duration);
    res.status === 200 ? successfulRequests.add(1) : failedRequests.add(1);
    
    sleep(2);
    
    // View random product detail
    const productId = testProducts[Math.floor(Math.random() * testProducts.length)];
    const detailRes = http.get(`${BASE_URL}/api/products/${productId}`);
    check(detailRes, {
      'product detail status 200 or 404': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);
    
    apiResponseTime.add(detailRes.timings.duration);
  });
}

function searchProducts() {
  group('Search Products', () => {
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    
    const res = http.get(`${BASE_URL}/api/products/search?q=${encodeURIComponent(query)}`);
    check(res, {
      'search API status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    
    apiResponseTime.add(res.timings.duration);
    res.status === 200 ? successfulRequests.add(1) : failedRequests.add(1);
  });
}

function checkoutFlow() {
  group('Checkout Flow', () => {
    // Register/Login (use guest checkout for load test)
    const loginPayload = JSON.stringify({
      email: `testuser${Math.floor(Math.random() * 10000)}@example.com`,
      password: 'Test@123456',
    });
    
    let res = http.post(`${BASE_URL}/api/auth/register`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    
    let token = '';
    if (res.status === 201 || res.status === 409) { // 409 = already exists
      // Try login
      res = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (res.status === 200) {
        try {
          const body = JSON.parse(res.body);
          token = body.data?.token || body.token;
        } catch {}
      }
    }
    
    sleep(1);
    
    if (token) {
      // Add to cart
      const cartPayload = JSON.stringify({
        productId: testProducts[0],
        quantity: 1,
        size: 'M',
        color: 'Red',
      });
      
      res = http.post(`${BASE_URL}/api/cart`, cartPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      check(res, {
        'add to cart status 200 or 201': (r) => r.status === 200 || r.status === 201,
      }) || errorRate.add(1);
      
      sleep(1);
      
      // View cart
      res = http.get(`${BASE_URL}/api/cart`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(res, {
        'get cart status 200': (r) => r.status === 200,
      }) || errorRate.add(1);
      
      apiResponseTime.add(res.timings.duration);
    }
  });
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options?.indent || '';
  const enableColors = options?.enableColors || false;
  
  let summary = '\n' + '='.repeat(80) + '\n';
  summary += '📊 LOAD TEST RESULTS\n';
  summary += '='.repeat(80) + '\n\n';
  
  summary += `${indent}Test Duration: ${formatDuration(data.state.testRunDurationMs)}\n`;
  summary += `${indent}Virtual Users: ${data.metrics.vus?.values?.max || 0}\n`;
  summary += `${indent}Total Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  summary += `${indent}Failed Requests: ${data.metrics.http_req_failed?.values?.passes || 0}\n`;
  summary += `${indent}Success Rate: ${((1 - (data.metrics.http_req_failed?.values?.rate || 0)) * 100).toFixed(2)}%\n\n`;
  
  summary += `${indent}Response Times:\n`;
  summary += `${indent}  Min: ${(data.metrics.http_req_duration?.values?.min || 0).toFixed(2)}ms\n`;
  summary += `${indent}  Avg: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  summary += `${indent}  Max: ${(data.metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms\n`;
  summary += `${indent}  P95: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `${indent}  P99: ${(data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms\n\n`;
  
  summary += `${indent}Requests per second: ${(data.metrics.http_reqs?.values?.rate || 0).toFixed(2)}\n`;
  summary += `${indent}Data received: ${formatBytes(data.metrics.data_received?.values?.count || 0)}\n`;
  summary += `${indent}Data sent: ${formatBytes(data.metrics.data_sent?.values?.count || 0)}\n\n`;
  
  // Check thresholds
  summary += `${indent}Threshold Status:\n`;
  const thresholds = data.metrics.http_req_duration?.thresholds || {};
  for (const [name, result] of Object.entries(thresholds)) {
    const status = result.ok ? '✅' : '❌';
    summary += `${indent}  ${status} ${name}\n`;
  }
  
  summary += '\n' + '='.repeat(80) + '\n';
  
  return summary;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
