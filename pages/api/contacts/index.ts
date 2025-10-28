// pages/api/contacts/index.ts
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CreateContactSchema = z.object({
  first_name: z.string().max(200).optional(),
  last_name: z.string().max(200).optional(),
  phone_e164: z.string().min(4).max(20),
  email: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
});

function isE164(phone: string) {
  return /^\+?[1-9]\d{1,14}$/.test(phone.trim());
}

function normalizePhone(phone: string) {
  return phone.trim();
}

function makeDedupeHash(phoneE164: string) {
  return crypto.createHash("sha256").update(phoneE164).digest("hex");
}

type ContactRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string;
  email: string | null;
  tags: string[] | null;
  source: string | null;
  created_at: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const {
      page = "1",
      per_page = "20",
      q,
      tags,
      source,
      phone,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(per_page || "20", 10)));
    const from = (pageNum - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from("contacts" as any)
      .select("*", { count: "exact" }) as any;
    if (q) {
      // simple text search on name/email
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`
      );
    }

    if (tags) {
      // tags expect comma separated
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagList.length) {
        // query for contacts where tags && tagList
        query = query.filter("tags", "cs", `{${tagList.join(",")}}`);
      }
    }

    if (source) {
      query = query.eq("source", source);
    }

    if (phone) {
      query = query.eq("phone_e164", phone);
    }

    const { data, count, error } = await query
      .range(from, to)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Contacts GET error:", error);
      return res.status(500).json({ error: "Failed to fetch contacts" });
    }

    return res.status(200).json({
      data: data ?? [],
      meta: { page: pageNum, per_page: perPage, total: count ?? 0 },
    });
  }

  if (req.method === "POST") {
    try {
      const parsed = CreateContactSchema.parse(req.body);

      if (!isE164(parsed.phone_e164)) {
        return res
          .status(400)
          .json({ error: "phone_e164 must be E.164 format" });
      }

      const normalized = {
        first_name: parsed.first_name ?? null,
        last_name: parsed.last_name ?? null,
        phone_e164: normalizePhone(parsed.phone_e164),
        email: parsed.email ?? null,
        tags: parsed.tags ?? null,
        source: parsed.source ?? null,
        dedupe_hash: makeDedupeHash(parsed.phone_e164),
      };

      const { data, error } = await supabase
        .from("contacts")
        .insert([normalized])
        .select()
        .single();

      if (error) {
        // if unique violation on phone_e164, provide friendly error
        const conflictMsg = (error as any)?.details ?? "";
        if (
          /duplicate|unique/.test(JSON.stringify(conflictMsg).toLowerCase())
        ) {
          return res
            .status(409)
            .json({ error: "Contact with this phone already exists" });
        }
        console.error("Contacts POST error:", error);
        return res.status(500).json({ error: "Failed to create contact" });
      }

      return res.status(201).json({ data });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      console.error("Contacts POST unexpected error:", err);
      return res
        .status(500)
        .json({ error: (err as Error).message ?? "Unknown error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
