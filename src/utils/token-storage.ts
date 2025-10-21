import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const STORAGE_DIR = path.join(process.env.APPDATA || process.env.HOME || '.', '.outlook-ai-agent');
const TOKEN_FILE = path.join(STORAGE_DIR, 'tokens.enc');
const ENCRYPTION_KEY = crypto.scryptSync('outlook-ai-agent-key', 'salt', 32);

export class TokenStorage {
  constructor() {
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  saveTokens(tokens: any): void {
    const encrypted = this.encrypt(JSON.stringify(tokens));
    fs.writeFileSync(TOKEN_FILE, encrypted, 'utf8');
  }

  loadTokens(): any | null {
    try {
      if (!fs.existsSync(TOKEN_FILE)) {
        return null;
      }
      const encrypted = fs.readFileSync(TOKEN_FILE, 'utf8');
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error loading tokens:', error);
      return null;
    }
  }

  clearTokens(): void {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  }
}
