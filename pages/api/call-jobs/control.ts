import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

type JobAction = "start" | "pause" | "resume" | "cancel";

interface ControlRequest {
  jobId: string;
  action: JobAction;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { jobId, action }: ControlRequest = req.body;

    const { data: job, error: fetchError } = await supabase
      .from("call_jobs")
      .select("id, status")
      .eq("id", jobId)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    let newStatus: string;

    switch (action) {
      case "start":
        if (job.status !== "draft") {
          return res.status(400).json({ error: "Job already started" });
        }
        newStatus = "queued";
        break;

      case "pause":
        if (job.status !== "running" && job.status !== "queued") {
          return res.status(400).json({ error: "Job not running" });
        }
        newStatus = "paused";
        break;

      case "resume":
        if (job.status !== "paused") {
          return res.status(400).json({ error: "Job not paused" });
        }
        newStatus = "queued";
        break;

      case "cancel":
        newStatus = "failed";
        break;

      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    const { error: updateError } = await supabase
      .from("call_jobs")
      .update({ status: newStatus })
      .eq("id", jobId);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ jobId, status: newStatus });
  } catch (error) {
    console.error("Control job error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
