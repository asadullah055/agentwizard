import type { NextApiRequest, NextApiResponse } from "next";
console.log("call");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ message: "RETELL_API_KEY environment variable is not set" });
  }

  try {
    const { agent_id, agent_version, metadata, retell_llm_dynamic_variables } =
      req.body || {};

    const payload = {
      agent_id,
      agent_version: agent_version || 1,
      metadata: metadata || {},
      retell_llm_dynamic_variables: retell_llm_dynamic_variables || {},
    };

    const retellRes = await fetch(
      "https://api.retellai.com/v2/create-web-call",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await retellRes.json().catch(() => ({}));
    if (!retellRes.ok) {
      return res
        .status(retellRes.status)
        .json({ message: data?.message || "Retell API error", ...data });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error?.message || "Internal Server Error" });
  }
}
