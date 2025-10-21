import { NotesService } from './notes-service';
import { StorageService } from './storage-service';
import { Email } from '../models/email.types';
import { Note } from '../models/note.types';
import { Entity } from '../models/storage.types';

interface RankedNote {
  note: Note;
  score: number;
  reason: string;
}

export class CorrelationService {
  private notesService: NotesService;
  private storageService: StorageService;

  constructor(notesService: NotesService, storageService: StorageService) {
    this.notesService = notesService;
    this.storageService = storageService;
  }

  async findRelatedNotes(email: Email, entities: Entity[]): Promise<Note[]> {
    const rankedNotes: RankedNote[] = [];

    // Search by entities
    for (const entity of entities) {
      if (entity.type === 'person' || entity.type === 'company' || entity.type === 'project') {
        const notes = await this.notesService.findNotesByEntity(entity.text, entity.type);
        
        for (const note of notes) {
          const existingNote = rankedNotes.find((rn) => rn.note.id === note.id);
          if (existingNote) {
            existingNote.score += entity.confidence;
          } else {
            rankedNotes.push({
              note,
              score: entity.confidence,
              reason: `Mentions ${entity.type}: ${entity.text}`,
            });
          }
        }
      }
    }

    // Search by email subject
    if (email.subject) {
      const subjectNotes = await this.notesService.searchNotes(email.subject);
      for (const note of subjectNotes) {
        const existingNote = rankedNotes.find((rn) => rn.note.id === note.id);
        if (existingNote) {
          existingNote.score += 0.5;
        } else {
          rankedNotes.push({
            note,
            score: 0.5,
            reason: 'Related to email subject',
          });
        }
      }
    }

    // Search by sender name
    if (email.from.name) {
      const senderNotes = await this.notesService.searchNotes(email.from.name);
      for (const note of senderNotes) {
        const existingNote = rankedNotes.find((rn) => rn.note.id === note.id);
        if (existingNote) {
          existingNote.score += 0.7;
        } else {
          rankedNotes.push({
            note,
            score: 0.7,
            reason: `Related to sender: ${email.from.name}`,
          });
        }
      }
    }

    // Semantic similarity using embeddings (if available)
    await this.addSemanticSimilarity(email, rankedNotes);

    // Sort by score and recency
    rankedNotes.sort((a, b) => {
      // Primary sort by score
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Secondary sort by recency
      return (
        b.note.lastModifiedDateTime.getTime() - a.note.lastModifiedDateTime.getTime()
      );
    });

    // Return top 10 notes
    return rankedNotes.slice(0, 10).map((rn) => rn.note);
  }

  private async addSemanticSimilarity(
    email: Email,
    rankedNotes: RankedNote[]
  ): Promise<void> {
    // This is a placeholder for semantic similarity
    // In a full implementation, you would:
    // 1. Generate embedding for email content
    // 2. Compare with stored note embeddings
    // 3. Add similarity scores to rankedNotes
    
    // For now, we'll skip this to keep the implementation simple
    // The embedding infrastructure is in place via StorageService
  }

  async correlateEmailWithNotes(email: Email, entities: Entity[]): Promise<string[]> {
    const relatedNotes = await this.findRelatedNotes(email, entities);
    return relatedNotes.map((note) => note.id);
  }

  calculateSimilarity(text1: string, text2: string): number {
    // Simple word-based similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}
