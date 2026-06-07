import { createServerFn } from "@tanstack/react-start";

const PARENT_FOLDER_ID = "1zPmcxPkigtiV8AeKk4_S_N1uuLVGzUEa";
const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;

function sanitizeFolderName(s: string) {
  return s.replace(/[\\\/:*?"<>|]/g, "-").slice(0, 120).trim();
}

async function driveFetch(path: string, init: RequestInit) {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const driveApiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableApiKey || !driveApiKey) {
    throw new Error("Missing required API keys for Google Drive");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${lovableApiKey}`);
  headers.set("X-Connection-Api-Key", driveApiKey);
  const res = await fetch(`${DRIVE_GATEWAY}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive ${path} failed: ${res.status} ${text}`);
  }
  return res;
}

export const uploadSubmissionFiles = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }) => {
    const submitter = String(data.get("submitter") ?? "submission");
    const title = String(data.get("title") ?? "untitled");
    const files = data.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) return { folderLink: "" };
    if (files.length > MAX_FILES) {
      throw new Error(`Too many files (max ${MAX_FILES})`);
    }
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        throw new Error(`"${f.name}" exceeds 25 MB limit`);
      }
    }

    // 1. Create subfolder
    const today = new Date().toISOString().slice(0, 10);
    const folderName = sanitizeFolderName(`${today} - ${submitter} - ${title}`);

    const folderRes = await driveFetch("/drive/v3/files?fields=id,webViewLink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [PARENT_FOLDER_ID],
      }),
    });
    const folder = (await folderRes.json()) as { id: string; webViewLink: string };

    // 2. Make folder readable by anyone with link
    try {
      await driveFetch(`/drive/v3/files/${folder.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    } catch (err) {
      console.warn("Could not set public link permission:", err);
    }

    // 3. Upload each file via multipart
    for (const file of files) {
      const metadata = {
        name: file.name,
        parents: [folder.id],
      };
      const boundary = `----lovable-${crypto.randomUUID()}`;
      const enc = new TextEncoder();
      const head = enc.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`
      );
      const tail = enc.encode(`\r\n--${boundary}--`);
      const body = new Uint8Array(head.byteLength + file.size + tail.byteLength);
      body.set(head, 0);
      body.set(new Uint8Array(await file.arrayBuffer()), head.byteLength);
      body.set(tail, head.byteLength + file.size);

      await driveFetch("/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
    }

    return { folderLink: folder.webViewLink };
  });
