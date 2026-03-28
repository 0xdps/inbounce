#!/usr/bin/env node

/**
 * Generate fake submissions for testing
 * 
 * Usage:
 *   node scripts/generate-submissions.mjs <api_key> [count] [endpoint]
 * 
 * Examples:
 *   node scripts/generate-submissions.mjs abc123def456 20
 *   node scripts/generate-submissions.mjs abc123def456 50 http://localhost:3000/api/submit
 *   node scripts/generate-submissions.mjs abc123def456 10 https://api.inbounce.app/submit
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const API_KEY = process.argv[2];
const COUNT = parseInt(process.argv[3] || '20', 10);
const ENDPOINT = process.argv[4] || 'http://inbounce.localhost:1355/api/submit';

// Polyfill fetch using http/https
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

if (!API_KEY) {
  console.error('❌ Error: API key is required');
  console.log('\nUsage:');
  console.log('  node scripts/generate-submissions.mjs <api_key> [count] [endpoint]');
  console.log('\nExamples:');
  console.log('  node scripts/generate-submissions.mjs abc123def456 20');
  console.log('  node scripts/generate-submissions.mjs abc123def456 50 http://localhost:61142/api/submit');
  process.exit(1);
}

// Fake data generators
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Rose', 'Sam', 'Tina'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'fastmail.com'];
const COMPANIES = ['Acme Corp', 'TechStart', 'InnovateLabs', 'DataFlow', 'CloudSync', 'DevTools Inc', 'AppWorks', 'CodeCraft', 'BuildFast', 'ScaleUp'];
const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte'];
const COUNTRIES = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Spain', 'Italy', 'Australia', 'Japan', 'Brazil', 'Mexico', 'India', 'China', 'South Korea', 'Netherlands'];

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(length = 10) {
  return Math.random().toString(36).substring(2, 2 + length);
}

function generateEmail() {
  const first = random(FIRST_NAMES).toLowerCase();
  const last = random(LAST_NAMES).toLowerCase();
  const num = randomInt(1, 999);
  return `${first}.${last}${Math.random() > 0.5 ? num : ''}@${random(DOMAINS)}`;
}

function generateUrl() {
  const protocols = ['https://'];
  const subdomains = ['', 'www.', 'app.', 'api.', 'blog.'];
  const names = ['example', 'demo', 'test', 'mysite', 'webapp', 'project', 'startup'];
  const tlds = ['.com', '.io', '.net', '.org', '.dev', '.app'];
  return `${random(protocols)}${random(subdomains)}${random(names)}${random(tlds)}`;
}

function generatePhone() {
  return `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`;
}

function generateDate() {
  const start = new Date(2020, 0, 1);
  const end = new Date();
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

function generateValueForType(type, name) {
  const lowerName = name.toLowerCase();
  
  // Smart generation based on field name
  if (lowerName.includes('email')) return generateEmail();
  if (lowerName.includes('phone') || lowerName.includes('mobile')) return generatePhone();
  if (lowerName.includes('url') || lowerName.includes('website') || lowerName.includes('link')) return generateUrl();
  if (lowerName.includes('company') || lowerName.includes('organization')) return random(COMPANIES);
  if (lowerName.includes('city')) return random(CITIES);
  if (lowerName.includes('country')) return random(COUNTRIES);
  if (lowerName.includes('name')) {
    if (lowerName.includes('first')) return random(FIRST_NAMES);
    if (lowerName.includes('last')) return random(LAST_NAMES);
    return `${random(FIRST_NAMES)} ${random(LAST_NAMES)}`;
  }
  if (lowerName.includes('age')) return randomInt(18, 80);
  if (lowerName.includes('price') || lowerName.includes('amount') || lowerName.includes('cost')) return randomInt(10, 1000);
  if (lowerName.includes('quantity') || lowerName.includes('count')) return randomInt(1, 100);
  if (lowerName.includes('rating') || lowerName.includes('score')) return randomInt(1, 5);
  
  // Fallback to type-based generation
  switch (type) {
    case 'email':
      return generateEmail();
    case 'url':
      return generateUrl();
    case 'number':
      return randomInt(1, 1000);
    case 'boolean':
      return Math.random() > 0.5;
    case 'date':
      return generateDate();
    case 'string':
    default:
      return `${name} ${randomString(8)}`;
  }
}

async function fetchSchema() {
  console.log('🔍 Fetching schema...');
  
  // Try to get schema from the app using API key
  // First, we need to find the app by API key, then get its schema
  // For now, we'll use a simple approach: try to submit and see what fields are required
  
  // Make a test submission to discover the schema
  const testResponse = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({})
  });
  
  if (!testResponse.ok) {
    const error = await testResponse.json().catch(() => ({}));
    if (error.details) {
      // Extract field names from Zod validation errors
      const fields = error.details.map(d => ({
        name: d.path[0],
        type: 'string' // Default to string, will be smart about it
      }));
      return fields;
    }
    throw new Error(`Failed to fetch schema: ${testResponse.status} ${testResponse.statusText}`);
  }
  
  return [];
}

async function generateSubmission(schema) {
  const data = {};
  
  for (const field of schema) {
    data[field.name] = generateValueForType(field.type, field.name);
  }
  
  return data;
}

async function submitData(data) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Submission failed: ${JSON.stringify(error)}`);
  }
  
  return await response.json();
}

async function main() {
  console.log('🚀 Fake Submission Generator');
  console.log(`📍 Endpoint: ${ENDPOINT}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`📊 Count: ${COUNT}`);
  console.log('');
  
  let schema = [];
  
  try {
    schema = await fetchSchema();
    if (schema.length > 0) {
      console.log(`✅ Discovered ${schema.length} fields: ${schema.map(f => f.name).join(', ')}`);
    } else {
      console.log('⚠️  No schema discovered, will generate random data');
    }
  } catch (error) {
    console.log(`⚠️  Could not fetch schema: ${error.message}`);
    console.log('⚠️  Will generate random data');
  }
  
  console.log('');
  console.log('📤 Starting submissions...');
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < COUNT; i++) {
    try {
      const data = schema.length > 0 
        ? await generateSubmission(schema)
        : { 
            email: generateEmail(),
            name: `${random(FIRST_NAMES)} ${random(LAST_NAMES)}`,
            message: `Test submission ${i + 1} - ${randomString(12)}`
          };
      
      await submitData(data);
      successCount++;
      
      process.stdout.write(`\r✅ Progress: ${i + 1}/${COUNT} (${successCount} success, ${failCount} failed)`);
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      failCount++;
      process.stdout.write(`\r❌ Progress: ${i + 1}/${COUNT} (${successCount} success, ${failCount} failed)`);
      
      if (i === 0) {
        // If first submission fails, show error and exit
        console.log('\n');
        console.error(`\n❌ First submission failed: ${error.message}`);
        console.error('Please check your API key and endpoint.');
        process.exit(1);
      }
    }
  }
  
  console.log('\n');
  console.log('');
  console.log('✨ Done!');
  console.log(`📊 Results: ${successCount} successful, ${failCount} failed`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
