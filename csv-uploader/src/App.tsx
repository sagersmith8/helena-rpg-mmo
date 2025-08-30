import { useState, useEffect } from "react";
import Papa from "papaparse";
import { Configuration, AbilitiesApi, AncestriesApi, BackgroundsApi, CharactersApi, CharacterSkillsApi, ClassesApi, ItemsApi, SkillsApi } from "../../api/index"; // Adjust the import path as needed

type CsvRow = Record<string, string>;
const configuration = new Configuration({basePath: 'http://98.127.121.74:3000'});
const API = {
    abilities: new AbilitiesApi(configuration),
    ancestries: new AncestriesApi(configuration),
    backgrounds: new BackgroundsApi(configuration),
    characters: new CharactersApi(configuration),
    characterSkills: new CharacterSkillsApi(configuration),
    classes: new ClassesApi(configuration),
    items: new ItemsApi(configuration),
    skills: new SkillsApi(configuration),
}

function App() {
  const [jsonData, setJsonData] = useState<CsvRow[] | null>(null);
  const [fetchedData, setFetchedData] = useState<any[]>(null);
  const [status, setStatus] = useState<string>("");
  const [selectedApi, setSelectedApi] = useState<keyof typeof API>("items");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setStatus(`Fetching ${selectedApi}...`);
        // @ts-expect-error: dynamic API call
        const res = await API[selectedApi][`${selectedApi}Get`]({});
        setFetchedData(res || []);
        setStatus(`Fetched ${res?.length ?? 0} ${selectedApi} ✅`);
      } catch (err) {
        console.error(`Failed to fetch ${selectedApi}:`, err);
        setStatus(`Failed to fetch ${selectedApi} ❌`);
      }
    };

    fetchData();
  }, [selectedApi]);

  const handleFile = (file: File | null) => {
    if (!file) return;

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
      setStatus(`Uploading ${selectedApi}...`);

      for (const row of jsonData) {
        const item: Items = JSON.parse(JSON.stringify(row));

        // Only check for duplicates if we're on items
        if (
          selectedApi === "items" &&
          fetchedData.some((existing: any) => existing.name === item.name)
        ) {
          console.log(
            `Item with name ${item.name} already exists, skipping upload.`
          );
          continue;
        }

        // @ts-expect-error: dynamic call
        const res = await API[selectedApi][`${selectedApi}Post`]({
          [selectedApi]: item,
        });
        console.log("API response:", res);
      }

      setStatus(`Upload successful ✅ (${selectedApi})`);
    } catch (err) {
      console.error(err);
      setStatus(`Upload failed ❌ (${selectedApi})`);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>CSV Uploader</h1>

      {/* API Selector Tabs */}
      <div style={{ marginBottom: "1rem" }}>
        {Object.keys(API).map((key) => (
          <button
            key={key}
            onClick={() => setSelectedApi(key as keyof typeof API)}
            style={{
              marginRight: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: selectedApi === key ? "#333" : "#eee",
              color: selectedApi === key ? "#fff" : "#000",
              cursor: "pointer",
            }}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Fetched data preview */}
      {fetchedData?.length > 0 ? (
        <pre style={{ textAlign: "left" }}>
          {JSON.stringify(fetchedData, null, 2)}
        </pre>
      ) : (
        <p>{status || `Loading ${selectedApi}...`}</p>
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
            Upload to {selectedApi}
          </button>
        </>
      )}

      {status && <p>{status}</p>}
    </div>
  );
}

export default App;
