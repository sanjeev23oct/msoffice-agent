import { Email } from './email.types';

export interface EmailAnalysis {
  emailId: string;
  priorityLevel: 'low' | 'medium' | 'high';
  priorityReason: string;
  entities: Entity[];
  actionItems: ActionItem[];
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  suggestedResponse?: string;
  relatedNotes: string[]; // Note IDs
  deadline?: Date;
  analyzedAt: Date;
}

export interface Entity {
  text: string;
  type: 'person' | 'company' | 'project' | 'location' | 'date';
  confidence: number;
}

export interface ActionItem {
  description: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface IStorageService {
  initialize(): Promise<void>;
  saveEmail(email: Email): Promise<void>;
  getEmail(id: string): Promise<Email | null>;
  saveAnalysis(emailId: string, analysis: EmailAnalysis): Promise<void>;
  getAnalysis(emailId: string): Promise<EmailAnalysis | null>;
  saveEmbedding(noteId: string, embedding: number[]): Promise<void>;
  getEmbedding(noteId: string): Promise<number[] | null>;
  clearCache(): Promise<void>;
}
