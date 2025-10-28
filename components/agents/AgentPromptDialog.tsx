export default function AgentPromptDialog({
  name,
  prompt,
  onClose,
}: {
  name: string;
  prompt: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-full max-w-lg p-6 rounded shadow relative">
        <h2 className="text-xl font-semibold mb-4">{name} – Prompt</h2>
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-80">
          {prompt}
        </pre>
        <div className="flex justify-between mt-4">
          <button
            onClick={() => navigator.clipboard.writeText(prompt)}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Copy
          </button>
          <button onClick={onClose} className="px-3 py-2 bg-gray-300 rounded">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
