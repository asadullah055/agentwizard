import AgentPromptDialog from "@/components/agents/AgentPromptDialog";
import Layout from "@/components/layout/Layout";
import { getProvider } from "@/lib/telephony";
import { ProviderName } from "@/lib/telephony/TelephonyProvider";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

interface Agent {
  id: string;
  name: string;
  provider: ProviderName;
  mode: "inbound" | "outbound";
  prompt_text: string | null;
  is_active: boolean;
  external_agent_id: string;
}

export default function AgentsSettingsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showPrompt, setShowPrompt] = useState<Agent | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    const { data } = await supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false });
    setAgents(data ?? []);
  }
  async function handleImport(provider: ProviderName) {
    const externalAgentId = prompt("Enter external agent ID");
    if (!externalAgentId) return;
    const providerClient = getProvider(provider);
    const imported = await providerClient.importAgent(externalAgentId);

    await supabase.from("agents").insert({
      name: imported.name,
      provider,
      mode: "outbound",
      external_agent_id: externalAgentId,
      prompt_text: imported.prompt,
      config_json: imported.config,
    });

    await loadAgents();
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Agents Settings</h1>

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => handleImport("retell")}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Import from Re:Tell
          </button>
          <button
            onClick={() => handleImport("vapi")}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Import from VAPI
          </button>
        </div>

        <table className="min-w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Provider</th>
              <th className="p-2 border">Mode</th>
              <th className="p-2 border">Active</th>
              <th className="p-2 border">Prompt</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="border p-2">{a.name}</td>
                <td className="border p-2">{a.provider}</td>
                <td className="border p-2">{a.mode}</td>
                <td className="border p-2">{a.is_active ? "✅" : "❌"}</td>
                <td className="border p-2">
                  <button
                    className="text-blue-600 underline"
                    onClick={() => setShowPrompt(a)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {showPrompt && (
          <AgentPromptDialog
            name={showPrompt.name}
            prompt={showPrompt.prompt_text ?? ""}
            onClose={() => setShowPrompt(null)}
          />
        )}
      </div>
    </Layout>
  );
}
