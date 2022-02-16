import { Lang, PrintSize, EditionType } from '@friends-library/types';

export interface EditionData {
  id: string;
  type: EditionType;
  pages: number;
  size: PrintSize;
  isbn: string;
}

export interface DocumentData {
  lang: Lang;
  title: string;
  isCompilation: boolean;
  description: string;
  editions: EditionData[];
  customHtml: string | null;
  customCss: string | null;
}

export interface FriendData {
  name: string;
  description: string;
  documents: DocumentData[];
}
