/* import { createClient } from "@supabase/supabase-js";
import csv from "csv-parser";
import formidable from "formidable";
import fs from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid"; // optional if you use generated types
export const config = {
  api: {
    bodyParser: false, // we’ll use formidable for multipart form parsing
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface ContactRow {
  first_name: string;
  last_name?: string;
  phone_e164: string;
  email?: string;
  tags?: string[];
  source?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const form = formidable({});
  const [fields, files] = await form.parse(req);

  const file = files.file?.[0];
  if (!file) return res.status(400).json({ error: "No CSV file uploaded" });

  const importId = uuidv4();
  const contacts: ContactRow[] = [];
  const invalidRows: any[] = [];

  const fileStream = fs.createReadStream(file.filepath);
  await new Promise<void>((resolve, reject) => {
    fileStream
      .pipe(csv())
      .on("data", (row) => {
        try {
          const contact: ContactRow = {
            first_name: row.first_name?.trim(),
            last_name: row.last_name?.trim(),
            phone_e164: normalizePhone(row.phone_e164),
            email: row.email?.trim() || null,
            tags: row.tags
              ? row.tags.split(",").map((t: string) => t.trim())
              : [],
            source: row.source?.trim() || "csv_import",
          };
          if (!contact.first_name || !contact.phone_e164)
            throw new Error("Missing required field");
          contacts.push(contact);
        } catch (e) {
          invalidRows.push(row);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });

  // Deduplication based on phone
  const uniqueContacts = dedupeByPhone(contacts);

  // Insert import job record
  const { data: importJob, error: importJobErr } = await supabase
    .from("import_jobs")
    .insert({
      id: importId,
      filename: file.originalFilename,
      status: "pending",
      total_rows: contacts.length,
      valid_rows: uniqueContacts.length,
      error_rows: invalidRows.length,
    })
    .select()
    .single();

  if (importJobErr)
    return res.status(500).json({ error: importJobErr.message });

  // Batch insert contacts (ignore duplicates)
  const { error: contactErr } = await supabase
    .from("contacts")
    .upsert(uniqueContacts, {
      onConflict: "phone_e164",
      ignoreDuplicates: true,
    });

  if (contactErr) {
    await supabase
      .from("import_jobs")
      .update({ status: "failed" })
      .eq("id", importId);
    return res.status(500).json({ error: contactErr.message });
  }

  // Update job status
  await supabase
    .from("import_jobs")
    .update({ status: "completed" })
    .eq("id", importId);

  return res.status(200).json({
    import_job_id: importId,
    total: contacts.length,
    valid: uniqueContacts.length,
    invalid: invalidRows.length,
  });
}

// ---- Helpers ---- //
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^+\d]/g, "");
  if (!cleaned.startsWith("+")) cleaned = "+1" + cleaned;
  return cleaned;
}

function dedupeByPhone(contacts: ContactRow[]): ContactRow[] {
  const map = new Map<string, ContactRow>();
  for (const c of contacts) {
    if (!map.has(c.phone_e164)) map.set(c.phone_e164, c);
  }
  return Array.from(map.values());
}
 */

import { createClient } from "@supabase/supabase-js";
import { parse as csvParse } from "csv-parse/sync";
import formidable from "formidable";
import fs from "fs/promises";
import { NextApiRequest, NextApiResponse } from "next";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to format phone for display
function formatPhoneForDisplay(phoneE164: string): string {
  const cleaned = phoneE164.replace(/\D/g, "");

  if (cleaned.startsWith("44")) {
    const local = cleaned.slice(2);
    if (local.startsWith("7") && local.length === 10) {
      return `0${local.slice(0, 5)} ${local.slice(5)}`;
    } else if (local.startsWith("1")) {
      return `0${local}`;
    } else if (local.startsWith("2")) {
      return `0${local}`;
    }
    return `0${local}`;
  }

  return phoneE164;
}

// Helper to ensure E164 format
function toE164Format(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return "";

  if (cleaned.startsWith("44")) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith("0") && cleaned.length >= 10) {
    return `+44${cleaned.slice(1)}`;
  } else {
    return `+${cleaned}`;
  }
}

// File parsing helper function
const parseForm = async (
  req: NextApiRequest
): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    const form = formidable({});
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      resolve({ fields, files });
    });
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse the form data
    const { files } = await parseForm(req);

    // Get the uploaded file
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Read the file content
    const fileContent = await fs.readFile(file.filepath, "utf-8");

    interface CSVRow {
      first_name?: string;
      firstname?: string;
      last_name?: string;
      lastname?: string;
      name?: string;
      email?: string;
      phone?: string;
      phone_number?: string;
      mobile?: string;
      phone_e164?: string;
      tags?: string;
      source?: string;
    }

    const records = csvParse<CSVRow>(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Create import job (if you have this table)
    let jobId = null;
    try {
      const { data: job } = await supabase
        .from("import_jobs")
        .insert({
          filename: file.originalFilename || "contacts.csv",
          status: "validating",
          total_rows: records.length,
        })
        .select()
        .single();

      jobId = job?.id;
    } catch (e) {
      console.log("Import jobs table not found, skipping job creation");
    }

    // Get existing contacts to check duplicates
    const { data: existingContacts, error: fetchError } = await supabase
      .from("contacts")
      .select("phone_e164");

    if (fetchError) {
      throw new Error(`Failed to fetch contacts: ${fetchError.message}`);
    }

    // Create a set of existing phones
    const existingPhonesSet = new Set<string>(
      existingContacts?.map((c) => c.phone_e164).filter(Boolean) || []
    );

    const validRows: any[] = [];
    const errors: string[] = [];
    const skipped: string[] = [];

    // Process each row
    for (const [index, row] of records.entries()) {
      // Try to get phone from different possible column names
      const rawPhone =
        row.phone || row.phone_number || row.mobile || row.phone_e164 || "";

      if (!rawPhone) {
        errors.push(`Row ${index + 1}: Missing phone number`);
        continue;
      }

      // Convert to E164 format
      const phoneE164 = toE164Format(rawPhone);

      if (!phoneE164 || phoneE164.length < 10) {
        errors.push(`Row ${index + 1}: Invalid phone format - ${rawPhone}`);
        continue;
      }

      // Check for duplicates
      if (existingPhonesSet.has(phoneE164)) {
        skipped.push(
          `Row ${index + 1}: Duplicate phone skipped - ${phoneE164}`
        );
        continue;
      }

      existingPhonesSet.add(phoneE164);

      // Format phone for display (stored in phone field)
      const phoneDisplay = formatPhoneForDisplay(phoneE164);

      // Build contact object matching your table structure
      const contact = {
        first_name:
          row.first_name || row.firstname || row.name?.split(" ")[0] || null,
        last_name:
          row.last_name ||
          row.lastname ||
          row.name?.split(" ").slice(1).join(" ") ||
          null,
        // full_name is auto-generated, no need to include
        email: row.email || null,
        phone: phoneDisplay, // ✅ Formatted phone for display
        phone_e164: phoneE164, // ✅ E164 format for uniqueness
        tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : [],
        source: row.source || "import", // ✅ Default "import"
        dedupe_hash: phoneE164, // Use phone as dedupe hash
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // created_by can be set if you have user context
        created_by: null,
      };

      validRows.push(contact);
    }

    // Insert valid rows in batches
    if (validRows.length > 0) {
      // Insert in batches of 100 to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("contacts")
          .insert(batch);

        if (insertError) {
          console.error("Batch insert error:", insertError);
          errors.push(
            `Failed to insert batch ${i / batchSize + 1}: ${
              insertError.message
            }`
          );
        }
      }
    }

    // Update import job if exists
    if (jobId) {
      await supabase
        .from("import_jobs")
        .update({
          status: "completed",
          valid_rows: validRows.length,
          error_rows: errors.length,
        })
        .eq("id", jobId);
    }

    // Clean up temp file
    try {
      await fs.unlink(file.filepath);
    } catch (e) {
      console.log("Could not delete temp file:", e);
    }

    // Return response
    return res.status(200).json({
      success: true,
      job_id: jobId,
      total: records.length,
      imported: validRows.length,
      skipped: skipped.length,
      failed: errors.length,
      errors: errors.slice(0, 100), // Limit errors in response
      skipped_details: skipped.slice(0, 50), // Some skip details
    });
  } catch (error: any) {
    console.error("Import error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
