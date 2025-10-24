import { GraphClient } from './graph-client';
import {
  INotesService,
  Notebook,
  Section,
  Note,
  NoteContent,
  Image,
} from '../models/note.types';
import { INotesProvider, NoteWithProvider } from '../models/provider.types';
import { AuthenticationService } from './authentication-service';

export class NotesService implements INotesService, INotesProvider {
  readonly providerType = 'microsoft' as const;
  readonly accountId: string;

  private graphClient: GraphClient;
  private authService: AuthenticationService;
  private notebookCache: Map<string, Notebook> = new Map();
  private noteCache: Map<string, NoteWithProvider> = new Map();

  constructor(graphClient: GraphClient, authService: AuthenticationService) {
    this.graphClient = graphClient;
    this.authService = authService;
    this.accountId = authService.accountId;
  }

  async getNotebooks(): Promise<Notebook[]> {
    const client = this.graphClient.getClient();

    const response = await this.graphClient.executeWithRetry(() =>
      client.api('/me/onenote/notebooks').get()
    );

    const notebooks: Notebook[] = [];

    for (const rawNotebook of response.value) {
      const sections = await this.getSections(rawNotebook.id);
      const notebook: Notebook = {
        id: rawNotebook.id,
        displayName: rawNotebook.displayName,
        sections: sections,
      };
      notebooks.push(notebook);
      this.notebookCache.set(notebook.id, notebook);
    }

    return notebooks;
  }

  private async getSections(notebookId: string): Promise<Section[]> {
    const client = this.graphClient.getClient();

    const response = await this.graphClient.executeWithRetry(() =>
      client.api(`/me/onenote/notebooks/${notebookId}/sections`).get()
    );

    return response.value.map((rawSection: any) => ({
      id: rawSection.id,
      displayName: rawSection.displayName,
      parentNotebookId: notebookId,
    }));
  }

  async searchNotes(query: string): Promise<NoteWithProvider[]> {
    const client = this.graphClient.getClient();

    // Search across all pages
    const response = await this.graphClient.executeWithRetry(() =>
      client
        .api('/me/onenote/pages')
        .filter(`contains(title,'${query}')`)
        .top(50)
        .get()
    );

    const notes: NoteWithProvider[] = [];

    for (const rawPage of response.value) {
      const note = await this.mapToNote(rawPage);
      notes.push(note);
      this.noteCache.set(note.id, note);
    }

    return notes;
  }

  async getNoteContent(noteId: string): Promise<NoteContent> {
    const client = this.graphClient.getClient();

    const response = await this.graphClient.executeWithRetry(() =>
      client.api(`/me/onenote/pages/${noteId}/content`).get()
    );

    const html = response;
    const plainText = this.htmlToPlainText(html);
    const images = this.extractImages(html);

    return {
      html,
      plainText,
      images,
    };
  }

  async findNotesByEntity(entityName: string, entityType: string): Promise<NoteWithProvider[]> {
    // For now, use simple search by entity name
    // In the future, this could be enhanced with semantic search
    return this.searchNotes(entityName);
  }

  private async mapToNote(rawPage: any): Promise<NoteWithProvider> {
    // Get section info to find notebook
    const client = this.graphClient.getClient();
    const accountInfo = this.authService.getAccountInfo();
    let notebookId = '';

    try {
      const section = await this.graphClient.executeWithRetry(() =>
        client.api(`/me/onenote/sections/${rawPage.parentSection.id}`).get()
      );
      notebookId = section.parentNotebook?.id || '';
    } catch (error) {
      console.error('Error getting section info:', error);
    }

    return {
      id: rawPage.id,
      title: rawPage.title || '(Untitled)',
      content: '', // Content loaded separately
      createdDateTime: new Date(rawPage.createdDateTime),
      lastModifiedDateTime: new Date(rawPage.lastModifiedDateTime),
      sectionId: rawPage.parentSection?.id || '',
      notebookId: notebookId,
      tags: [], // OneNote tags would need separate API call
      providerType: 'microsoft',
      accountId: this.accountId,
      accountEmail: accountInfo.email,
    };
  }

  private htmlToPlainText(html: string): string {
    // Simple HTML to plain text conversion
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractImages(html: string): Image[] {
    const images: Image[] = [];
    const imgRegex = /<img[^>]+src="([^">]+)"[^>]*alt="([^">]*)"[^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      images.push({
        url: match[1],
        alt: match[2] || '',
      });
    }

    return images;
  }

  clearCache(): void {
    this.notebookCache.clear();
    this.noteCache.clear();
  }
}
