import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });

class Config {
  constructor() {
    this.adminKey = this._requireEnv('ADMIN_KEY');
    this.sessionSecret = this._requireEnv('SESSION_SECRET');

    if (this.sessionSecret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters');
    }

    this.sqliteHubUrl = this._requireEnv('SQLITE_HUB_URL');
    this.sqliteHubDb = this._requireEnv('SQLITE_HUB_DB');
    this.sqliteHubServiceSecret = this._requireEnv('SQLITE_HUB_SERVICE_SECRET');

    this.port = parseInt(process.env.PORT || '3000', 10);
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.nodeEnv = process.env.NODE_ENV || 'development';
  }

  _requireEnv(key) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value;
  }

  isProduction() {
    return this.nodeEnv === 'production';
  }

  isDevelopment() {
    return this.nodeEnv === 'development';
  }
}

export default new Config();
