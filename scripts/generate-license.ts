import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// Generate RSA key pair for development
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

console.log('=== PUBLIC KEY (embed in app) ===');
console.log(publicKey);
console.log('=== PRIVATE KEY (keep secret) ===');
console.log(privateKey);

// Generate a sample license
const license = jwt.sign(
  {
    plan: process.argv[2] || 'pro',
    tenantName: process.argv[3] || 'Demo Org',
    maxUsers: 20,
    maxTicketsPerMonth: 500,
    maxAgentTasksPerMonth: 100,
    maxRepos: 5,
    features: ['auto_merge', 'audit_logs', 'multi_provider_ai'],
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  privateKey,
  { algorithm: 'RS256', expiresIn: '365d' },
);

console.log('\n=== LICENSE KEY ===');
console.log(license);
