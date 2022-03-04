/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { Lang, EditionType, PrintSize } from './globalTypes';

// ====================================================
// GraphQL query operation: GetFriends
// ====================================================

export interface GetFriends_friends_documents_editions_isbn {
  __typename: 'Isbn';
  code: string;
}

export interface GetFriends_friends_documents_editions_impression {
  __typename: 'EditionImpression';
  paperbackVolumes: number[];
  paperbackSize: PrintSize;
}

export interface GetFriends_friends_documents_editions {
  __typename: 'Edition';
  id: string;
  path: string;
  type: EditionType;
  isbn: GetFriends_friends_documents_editions_isbn | null;
  impression: GetFriends_friends_documents_editions_impression | null;
}

export interface GetFriends_friends_documents {
  __typename: 'Document';
  title: string;
  description: string;
  directoryPath: string;
  editions: GetFriends_friends_documents_editions[];
}

export interface GetFriends_friends {
  __typename: 'Friend';
  name: string;
  lang: Lang;
  description: string;
  isCompilations: boolean;
  documents: GetFriends_friends_documents[];
}

export interface GetFriends {
  friends: GetFriends_friends[];
}
