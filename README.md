# Next Docs

A local-first collaborative document editor built with Next.js App Router, MongoDB, Auth.js, Socket.IO, Dexie, and free local writing tools.

## Features

- Email-password authentication with protected routes.
- Document dashboard with search.
- Functional simple editor with formatting tools, preview, find/replace, stats, debounced autosave and  manual version checkpoints.
- Owner / editor / viewer roles with collaborator invites.
- Socket.IO document rooms for live update broadcasting and collaborator presence.
- IndexedDB offline cache and queued saves that sync when the browser returns online.
- Conflict detection with keep-server, overwrite, and merge options.
- Version history with restore option.
- SMTP collaborator invite emails.
- Free local editor tools: bold, italic, headings, lists, links, preview, word count, reading time, and find/replace.

## Setup

1. Install dependencies:

npm install

2. Copy `.env.example` to `.env.local` and fill.


3. Run the Socket.IO-enabled development server:

npm run dev

4. Open `http://localhost:3000`.


## Scripts

- **`npm run dev`** – Start.
- **`npm run build`** – Production build.
- **`npm run start`** – Start the production server.
- **`npm run lint`** – Run ESLint.
- **`npm run test`** – Run integration tests.


## Submission checklist (completed points)

- Register and login.
- Create, search, open, edit, autosave, and delete documents.
- Invite a registered collaborator and verify viewer/editor permissions.
- Configure SMTP and verify collaborator invite emails are delivered.
- Toggle the browser offline, edit, return online, and confirm sync.
- Open the same document in two sessions and verify conflict handling options.
- Create manual saves and restore from version history.
- Try local editor tools: formatting, preview, stats, and find/replace.
- Responsiveness
