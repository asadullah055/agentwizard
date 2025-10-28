import { useState } from "react";

export default function CsvUploadWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);

  async function handleUpload() {
    if (!file) return alert("Select a CSV file first");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/contacts/import", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setUploading(false);
    setResult(data);
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow">
      <h2 className="text-xl font-semibold mb-4">Import Contacts (CSV)</h2>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="border p-2 w-full"
      />
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Upload CSV"}
      </button>

      {result && (
        <div className="mt-6 bg-gray-50 p-4 rounded">
          <p>Total Rows: {result.total}</p>
          <p>Valid: {result.valid}</p>
          <p>Invalid: {result.invalid}</p>
        </div>
      )}
    </div>
  );
}
