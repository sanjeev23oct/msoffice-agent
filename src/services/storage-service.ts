import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { IStorageService, EmailAnalysis } from '../models/storage.types';
import { Email } from '../models/email.types';

const STORAGE_DIR = path.join(
  process.env.APPDATA || process.env.HOME || '.',
  '.outlook-ai-agent'
);
const DB_FILE = path.join(STORAGE_DIR, 'agent.db');

export class StorageService implements IStorageService {
  private db: Database | null = null;
  private cacheTTL: number;

  constructor(cacheTTL: number = 7 * 24 * 60 * 60 * 1000) {
    // 7 days default
    this.cacheTTL = cacheTTL;
  }

  async initialize(): Promise<void> {
    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    // Initialize SQL.js
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(DB_FILE)) {
      const buffer = fs.readFileSync(DB_FILE);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      await this.createTables();
      this.saveDatabase();
    }

    console.log('✅ Storage service initialized');
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Emails table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        subject TEXT,
        from_address TEXT,
        body TEXT,
        received_date INTEGER,
        importance TEXT,
        is_read INTEGER,
        provider_type TEXT,
        account_id TEXT,
        created_at INTEGER
      )
    `);

    // Accounts table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider_type TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        created_at INTEGER NOT NULL,
        last_sync INTEGER
      )
    `);

    // Email analysis table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS email_analysis (
        email_id TEXT PRIMARY KEY,
        priority_level TEXT,
        priority_reason TEXT,
        entities TEXT,
        action_items TEXT,
        sentiment TEXT,
        summary TEXT,
        suggested_response TEXT,
        related_notes TEXT,
        deadline INTEGER,
        analyzed_at INTEGER,
        FOREIGN KEY (email_id) REFERENCES emails(id)
      )
    `);

    // Embeddings table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS embeddings (
        note_id TEXT PRIMARY KEY,
        embedding BLOB,
        created_at INTEGER
      )
    `);

    // Create indexes
    this.db.run('CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(received_date)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_analysis_priority ON email_analysis(priority_level)');
  }

  async saveEmail(email: Email | any): Promise<void> {
    // For MVP: Skip if DB not initialized (no persistence needed)
    if (!this.db) {
      console.log('Storage not initialized - skipping email save (MVP mode)');
      return;
    }

    const providerType = (email as any).providerType || 'microsoft';
    const accountId = (email as any).accountId || 'microsoft-default';

    this.db.run(
      `INSERT OR REPLACE INTO emails 
       (id, subject, from_address, body, received_date, importance, is_read, provider_type, account_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email.id,
        email.subject,
        email.from.address,
        email.body,
        email.receivedDateTime.getTime(),
        email.importance,
        email.isRead ? 1 : 0,
        providerType,
        accountId,
        Date.now(),
      ]
    );

    this.saveDatabase();
  }

  async getEmail(id: string): Promise<Email | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM emails WHERE id = ?',
      [id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return this.mapRowToEmail(row, result[0].columns);
  }

  async saveAnalysis(emailId: string, analysis: EmailAnalysis): Promise<void> {
    // For MVP: Skip if DB not initialized (no persistence needed)
    if (!this.db) {
      console.log('Storage not initialized - skipping analysis save (MVP mode)');
      return;
    }

    this.db.run(
      `INSERT OR REPLACE INTO email_analysis 
       (email_id, priority_level, priority_reason, entities, action_items, 
        sentiment, summary, suggested_response, related_notes, deadline, analyzed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emailId,
        analysis.priorityLevel,
        analysis.priorityReason,
        JSON.stringify(analysis.entities),
        JSON.stringify(analysis.actionItems),
        analysis.sentiment,
        analysis.summary,
        analysis.suggestedResponse || null,
        JSON.stringify(analysis.relatedNotes),
        analysis.deadline?.getTime() || null,
        analysis.analyzedAt.getTime(),
      ]
    );

    this.saveDatabase();
  }

  async getAnalysis(emailId: string): Promise<EmailAnalysis | null> {
    // For MVP: Return null if DB not initialized (no persistence needed)
    if (!this.db) {
      console.log('Storage not initialized - skipping analysis lookup (MVP mode)');
      return null;
    }

    const result = this.db.exec(
      'SELECT * FROM email_analysis WHERE email_id = ?',
      [emailId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return this.mapRowToAnalysis(row, result[0].columns);
  }

  async saveEmbedding(noteId: string, embedding: number[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const buffer = Buffer.from(new Float32Array(embedding).buffer);

    this.db.run(
      'INSERT OR REPLACE INTO embeddings (note_id, embedding, created_at) VALUES (?, ?, ?)',
      [noteId, buffer, Date.now()]
    );

    this.saveDatabase();
  }

  async getEmbedding(noteId: string): Promise<number[] | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT embedding FROM embeddings WHERE note_id = ?',
      [noteId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const buffer = result[0].values[0][0] as Uint8Array;
    const float32Array = new Float32Array(buffer.buffer);
    return Array.from(float32Array);
  }

  async clearCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = Date.now() - this.cacheTTL;

    this.db.run('DELETE FROM emails WHERE created_at < ?', [cutoffTime]);
    this.db.run('DELETE FROM embeddings WHERE created_at < ?', [cutoffTime]);

    this.saveDatabase();
    console.log('✅ Cache cleared');
  }

  private saveDatabase(): void {
    if (!this.db) return;
    const data = this.db.export();
    fs.writeFileSync(DB_FILE, data);
  }

  private mapRowToEmail(row: any[], columns: string[]): Email {
    const getColumn = (name: string) => {
      const index = columns.indexOf(name);
      return row[index];
    };

    return {
      id: getColumn('id') as string,
      subject: getColumn('subject') as string,
      from: {
        name: '',
        address: getColumn('from_address') as string,
      },
      to: [],
      body: getColumn('body') as string,
      receivedDateTime: new Date(getColumn('received_date') as number),
      hasAttachments: false,
      importance: getColumn('importance') as any,
      isRead: getColumn('is_read') === 1,
      conversationId: '',
    };
  }

  private mapRowToAnalysis(row: any[], columns: string[]): EmailAnalysis {
    const getColumn = (name: string) => {
      const index = columns.indexOf(name);
      return row[index];
    };

    return {
      emailId: getColumn('email_id') as string,
      priorityLevel: getColumn('priority_level') as any,
      priorityReason: getColumn('priority_reason') as string,
      entities: JSON.parse(getColumn('entities') as string),
      actionItems: JSON.parse(getColumn('action_items') as string),
      sentiment: getColumn('sentiment') as any,
      summary: getColumn('summary') as string,
      suggestedResponse: getColumn('suggested_response') as string | undefined,
      relatedNotes: JSON.parse(getColumn('related_notes') as string),
      deadline: getColumn('deadline') ? new Date(getColumn('deadline') as number) : undefined,
      analyzedAt: new Date(getColumn('analyzed_at') as number),
    };
  }
}
