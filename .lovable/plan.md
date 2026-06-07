# Plan: File uploads → Google Drive subfolder per submission

## What changes for the user
- The "Materials" textarea on step 3 becomes a real file upload control.
- Up to 10 files, 25 MB each, any file type.
- On submit, a new subfolder is created in the target Drive folder (`1zPmcxPkigtiV8AeKk4_S_N1uuLVGzUEa`), all selected files are uploaded into it, and the Google Sheet row stores a link to that folder in place of the old Materials text.

## Connector setup
- Link the **Google Drive** connector (the existing Google Sheets connection only covers Sheets scope). User will be prompted in chat to authorize Drive with write access to the parent folder.
- Parent folder ID hard-coded as a constant: `1zPmcxPkigtiV8AeKk4_S_N1uuLVGzUEa`.

## Backend (`src/lib/sheets.functions.ts` + new `src/lib/drive.functions.ts`)
1. New server function `uploadSubmissionFiles`:
   - Input: `FormData` with `submissionName` + file blobs.
   - Validates count ≤ 10 and each file ≤ 25 MB server-side.
   - Calls Drive gateway `POST /files` to create a subfolder named `YYYY-MM-DD - {Full Name} - {Initiative Title}` inside the parent folder.
   - For each file, multipart-uploads to `POST /upload/drive/v3/files?uploadType=multipart` with `parents: [subfolderId]`.
   - Sets the subfolder to "anyone with link can view" via `POST /files/{id}/permissions` so reviewers in the sheet can open it.
   - Returns the subfolder's `webViewLink`.
2. `submitInitiative` updated:
   - Drops the `files` string field, accepts `folderLink` instead.
   - Writes that link into the existing Materials column (column I) so the sheet schema is unchanged — just repurposed. Header text in the sheet stays "Materials" (no rewrite needed; the link is self-explanatory). If you'd prefer the header renamed to "Files", say so and I'll update it.

## Frontend (`src/routes/index.tsx`)
- Replace the Materials `<textarea>` with a styled drop zone + `<input type="file" multiple>`.
- Show selected file list with size + remove button; enforce 10 files / 25 MB client-side with inline errors.
- Submit flow:
  1. If files selected → call `uploadSubmissionFiles` first, get folder link.
  2. Call `submitInitiative` with `folderLink` (or empty string if no files).
  3. Show existing success state.
- Add an "Uploading files…" progress state between steps.

## Edge cases handled
- Zero files: skip Drive call, write empty string to sheet.
- Drive call fails: surface error, do NOT write to sheet (so user can retry without duplicate row).
- File >25 MB or >10 files: blocked client-side and re-validated server-side.

## Out of scope
- No virus scanning, no thumbnail previews, no resumable uploads (multipart is fine ≤25 MB).
- No per-user OAuth — uploads go into the workspace owner's Drive via the connector.
