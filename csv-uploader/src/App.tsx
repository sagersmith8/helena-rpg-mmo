import { useState, useEffect } from "react";
import Papa from "papaparse";
import { Configuration, ItemsApi } from "../../api/index"; // Adjust the import path as needed
import type { Items } from "../../api/models/Items";

type CsvRow = Record<string, string>;

function App() {
  const [jsonData, setJsonData] = useState<CsvRow[] | null>(null);
  const [items, setItems] = useState<any[]>(null);
  const [status, setStatus] = useState<string>("");
  const config = new Configuration({basePath: 'http://10.46.235.105:3000'});
  const itemsApi = new ItemsApi(config);

    useEffect(() => {
      const fetchItems = async () => {
        try {
          const res = await itemsApi.itemsGet({});
          setItems(res); // store in state
          console.log("Fetched items:", res);
        } catch (err) {
          console.error("Failed to fetch items:", err);
          setStatus("Failed to fetch items ❌");
        }
      };

      fetchItems();
    }, []);

  const handleFile = (file: File | null) => {
    if (!file) return 'No file uploaded';

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Parsed CSV:", results.data);
        setJsonData(results.data);
      },
    });
  };

  const handleUpload = async () => {
    if (!jsonData) return;

    try {
      setStatus("Uploading...");

      for (const row of jsonData) {
          const item: Items = JSON.parse(JSON.stringify(row));
          // skip item if it already exists in items
            if (items.some(existingItem => existingItem.name === item.name)) {
                console.log(`Item with name ${item.name} already exists, skipping upload.`);
                continue;
            }
          const res = await itemsApi.itemsPost({
            items: item,
          });
          console.log("API response:", res);
      }
      setStatus("Upload successful ✅");
      // Example call – change depending on your OpenAPI client
    } catch (err) {
      console.error(err);
      setStatus("Upload failed ❌");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>CSV Uploader</h1>

      {/* Render fetched items */}
      {items != null ? (
        <pre style={{ textAlign: "left" }}>
          {JSON.stringify(items, null, 2)}
        </pre>
      ) : (
        <p>{status || "Loading items..."}</p>
      )}
      <input
        type="file"
        accept=".csv"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {jsonData && (
        <>
          <pre style={{ textAlign: "left", marginTop: "1rem" }}>
            {JSON.stringify(jsonData.slice(0, 5), null, 2)}
          </pre>
          <button onClick={handleUpload} style={{ marginTop: "1rem" }}>
            Upload to API
          </button>
        </>
      )}

      {status && <p>{status}</p>}
    </div>
  );
}

export default App;
