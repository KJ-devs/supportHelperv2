import { registerAs } from '@nestjs/config';

/**
 * Application configuration
 */
export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '3001', 10),
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:3001',
}));
