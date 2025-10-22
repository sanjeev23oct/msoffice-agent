import { google, drive_v3, docs_v1 } from 'googleapis';
import { GoogleAuthService } from './google-auth-service';
import { INotesProvider, NoteWithProvider, Notebook, Section, NoteContent } from '../models/provider.types';

export class GoogleDocsService implements INotesProvider {
  readonly providerType = 'google' as const;
  readonly accountId: string;

  private drive: drive_v3.Drive;
  private docs: docs_v1.Docs;
  private authService: GoogleAuthService;

  constructor(authService: GoogleAuthService) {
    this.authService = authService;
    this.accountId = authService.accountId;
    
    const auth = authService.getOAuth2Client();
    this.drive = google.drive({ version: 'v3', auth });
    this.docs = google.docs({ version: 'v1', auth });
  }

  async getNotebooks(): Promise<Notebook[]> {
    try {
      // In Google Drive, we'll treat folders as "notebooks"
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)',
        pageSize: 100,
      });

      const folders = response.data.files || [];
      
      return folders.map((folder) => ({
        id: folder.id || '',
        displayName: folder.name || 'Untitled Folder',
        sections: [], // Google Drive doesn't have sections like OneNote
      }));
    } catch (error) {
      console.error('Error getting notebooks:', error);
      return [];
    }
  }

  async searchNotes(query: string): Promise<NoteWithProvider[]> {
    try {
      // Search for Google Docs
      const response = await this.drive.files.list({
        q: `(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.note') and fullText contains '${query}' and trashed=false`,
        fields: 'files(id, name, createdTime, modifiedTime, parents)',
        pageSize: 50,
        orderBy: 'modifiedTime desc',
      });

      const files = response.data.files || [];
      const notes: NoteWithProvider[] = [];

      for (const file of files) {
        try {
          const note = await this.mapDriveFileToNote(file);
          notes.push(note);
        } catch (error) {
          console.error(`Error mapping file ${file.id}:`, error);
        }
      }

      return notes;
    } catch (error) {
      console.error('Error searching notes:', error);
      return [];
    }
  }

  async getNoteContent(noteId: string): Promise<NoteContent> {
    try {
      // Get the document content
      const doc = await this.docs.documents.get({
        documentId: noteId,
      });

      // Extract plain text from the document
      let plainText = '';
      if (doc.data.body?.content) {
        for (const element of doc.data.body.content) {
          if (element.paragraph?.elements) {
            for (const textElement of element.paragraph.elements) {
              if (textElement.textRun?.content) {
                plainText += textElement.textRun.content;
              }
            }
          }
        }
      }

      // For HTML, we'll use a simple conversion
      const html = `<html><body><pre>${plainText}</pre></body></html>`;

      return {
        html,
        plainText,
        images: [], // TODO: Extract images if needed
      };
    } catch (error) {
      console.error('Error getting note content:', error);
      return {
        html: '',
        plainText: '',
        images: [],
      };
    }
  }

  async findNotesByEntity(entityName: string, entityType: string): Promise<NoteWithProvider[]> {
    // Use search with the entity name
    return this.searchNotes(entityName);
  }

  clearCache(): void {
    console.log('Google Docs cache cleared (no-op)');
  }

  private async mapDriveFileToNote(file: drive_v3.Schema$File): Promise<NoteWithProvider> {
    const accountInfo = this.authService.getAccountInfo();

    // Get parent folder name if available
    let notebookName = 'My Drive';
    let notebookId = 'root';
    
    if (file.parents && file.parents.length > 0) {
      notebookId = file.parents[0];
      try {
        const parent = await this.drive.files.get({
          fileId: notebookId,
          fields: 'name',
        });
        notebookName = parent.data.name || 'My Drive';
      } catch (error) {
        // Ignore error, use default
      }
    }

    // Get content preview
    let content = '';
    try {
      const noteContent = await this.getNoteContent(file.id!);
      content = noteContent.plainText.substring(0, 500); // First 500 chars
    } catch (error) {
      // Ignore error
    }

    return {
      id: file.id || '',
      title: file.name || 'Untitled Document',
      content,
      createdDateTime: file.createdTime ? new Date(file.createdTime) : new Date(),
      lastModifiedDateTime: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
      sectionId: notebookId,
      notebookId,
      tags: [],
      providerType: 'google',
      accountId: this.accountId,
      accountEmail: accountInfo.email,
      metadata: {
        documentId: file.id,
        mimeType: file.mimeType,
        notebookName,
        sectionName: notebookName,
      },
    };
  }
}
