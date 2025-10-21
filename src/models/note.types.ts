export interface Notebook {
  id: string;
  displayName: string;
  sections: Section[];
}

export interface Section {
  id: string;
  displayName: string;
  parentNotebookId: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdDateTime: Date;
  lastModifiedDateTime: Date;
  sectionId: string;
  notebookId: string;
  tags: string[];
}

export interface NoteContent {
  html: string;
  plainText: string;
  images: Image[];
}

export interface Image {
  url: string;
  alt: string;
}

export interface INotesService {
  getNotebooks(): Promise<Notebook[]>;
  searchNotes(query: string): Promise<Note[]>;
  getNoteContent(noteId: string): Promise<NoteContent>;
  findNotesByEntity(entityName: string, entityType: string): Promise<Note[]>;
}
