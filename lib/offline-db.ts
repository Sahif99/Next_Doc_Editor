"use client";

import Dexie, { Table } from "dexie";

export interface OfflineDocument {
  id: string;
  title: string;
  content: string;
  role?: "OWNER" | "EDITOR" | "VIEWER";
  revision?: number;
  updatedAt: string;
}

export interface OfflineQueueItem {
  id?: number;
  operationId: string;
  documentId: string;
  title: string;
  content: string;
  baseTitle: string;
  baseContent: string;
  baseRevision: number;
  createdAt: string;
  nextAttemptAt: string;
  attempts: number;
  status: "pending" | "syncing" | "conflict" | "failed";
  lastError?: string;
}

class NextDocsOfflineDB extends Dexie {
  documents!: Table<OfflineDocument, string>;
  queue!: Table<OfflineQueueItem, number>;

  constructor() {
    super("next-docs-offline");
    this.version(1).stores({
      documents: "id, updatedAt",
      queue: "++id, documentId, createdAt",
    });
    this.version(2).stores({
      documents: "id, updatedAt",
      queue: "++id, documentId, status, nextAttemptAt, createdAt, operationId",
    });
  }
}

export const offlineDB = new NextDocsOfflineDB();
