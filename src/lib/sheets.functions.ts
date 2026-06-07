import { createServerFn } from "@tanstack/react-start";

const SPREADSHEET_ID = "1yOc3ZmjJ91tdkqGZV-C6oUTJfV3a8K5I0UJ7JsnbGxw";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const submitInitiative = createServerFn({ method: "POST" })
  .inputValidator((data: {
    name: string;
    email: string;
    org: string;
    title: string;
    type: string;
    desc: string;
    link: string;
    files: string;
  }) => data)
  .handler(async ({ data }) => {
    const lovableApiKey = process.env.LOVABLE_API_KEY;
    const sheetsApiKey = process.env.GOOGLE_SHEETS_API_KEY;

    if (!lovableApiKey || !sheetsApiKey) {
      throw new Error("Missing required API keys for Google Sheets");
    }

    const timestamp = new Date().toISOString();

    const body = {
      values: [[
        timestamp,
        data.name,
        data.email,
        data.org,
        data.title,
        data.type,
        data.desc,
        data.link,
        data.files,
      ]],
    };

    const range = "Sheet1!A:I";
    const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": sheetsApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Google Sheets append failed:", response.status, text);
      throw new Error(`Failed to append to sheet: ${response.status} ${text}`);
    }

    return { success: true };
  });
