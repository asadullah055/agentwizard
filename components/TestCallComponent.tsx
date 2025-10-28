import { useEffect, useState } from "react";

interface Agent {
  id: string;
  name: string;
  provider: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  phone_e164: string;
}

export default function TestCallComponent() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    // Load agents
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setAgents);

    // Load contacts
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts || []));
  }, []);

  const handleStartCall = async () => {
    if (!selectedAgent || !selectedContact) {
      alert("Please select agent and contact");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent,
          contactId: selectedContact,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`✅ Call initiated: ${data.externalCallId}`);
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Test Outbound Call</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select agent...</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.provider})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Contact</label>
          <select
            value={selectedContact}
            onChange={(e) => setSelectedContact(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select contact...</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name} - {c.phone_e164}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleStartCall}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Starting..." : "Start Call"}
        </button>

        {result && (
          <div className="p-4 bg-gray-50 rounded border">
            <pre className="text-sm">{result}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
