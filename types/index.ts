import { Types } from "mongoose";

export type UserRole =
  | "OWNER"
  | "EDITOR"
  | "VIEWER";

export interface IUser {
  _id?: Types.ObjectId;

  name: string;

  email: string;

  password: string;

  avatar?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export interface ICollaborator {
  user: Types.ObjectId;

  role: UserRole;
}

export interface IDocument {
  _id?: Types.ObjectId;

  title: string;

  content: string;

  owner: Types.ObjectId;

  collaborators: ICollaborator[];

  lastEditedBy?: Types.ObjectId;

  lastSavedAt?: Date;

  revision?: number;

  createdAt?: Date;

  updatedAt?: Date;
}

export interface IVersion {
  _id?: Types.ObjectId;

  document: Types.ObjectId;

  content: string;

  title: string;

  label?: string;

  createdBy: Types.ObjectId;

  createdAt?: Date;
}
