import { useState, useEffect } from "react";
import Papa from "papaparse";
import { API, API_TYPES } from "./apiClient";
import type { Skills, Abilities } from "../../api/index";

type CsvRow = Record<string, string>;

function App() {
  const [jsonData, setJsonData] = useState<CsvRow[] | null>(null);
  const [fetchedData, setFetchedData] = useState<any[]>(null);
  const [status, setStatus] = useState<string>("");
  const [selectedApi, setSelectedApi] = useState<keyof typeof API>("items");
  const [skills, setSkills] = useState<Skills[] | null>(null);
  const [abilities, setAbilities] = useState<Abilities[] | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setStatus(`Fetching ${selectedApi}...`);
        // @ts-expect-error: dynamic API call
        const res = await API[selectedApi][`${selectedApi}Get`]({});
        setFetchedData(res || []);
        if (selectedApi === "abilitiesRequiredItems") {
          const a = await API["abilities"][`abilitiesGet`]({});
          setAbilities(a || []);
        } else if (selectedApi === "abilitiesRequiredLevels") {
          const s = await API["skills"][`skillsGet`]({});
          setSkills(s || []);
          const a = await API["abilities"][`abilitiesGet`]({});
          setAbilities(a || []);
        }

        setStatus(`Fetched ${res?.length ?? 0} ${selectedApi} ✅`);
      } catch (err) {
        console.error(`Failed to fetch ${selectedApi}:`, err);
       if (err.response) {
         console.error("Status:", err.response.status);
         try {
           const body = await err.response.text();
           console.error("Body:", body);
         } catch (parseErr) {
           console.error("Could not parse error body:", parseErr);
         }
       }
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
        const camelRows = results.data.map(row => keysToCamel(row));
        console.log("Parsed CSV:", camelRows);
        setJsonData(camelRows);
      },
    });
  };

  function toCamelCase(str: string) {
    return str.replace(/([-_][a-z])/gi, (match) =>
      match.toUpperCase().replace(/[-_]/g, "")
    );
  }

  function keysToCamel<T>(obj: any): T {
    if (Array.isArray(obj)) {
      return obj.map((v) => keysToCamel(v)) as any;
    } else if (obj !== null && obj.constructor === Object) {
      return Object.keys(obj).reduce((acc: any, key) => {
        acc[toCamelCase(key)] = keysToCamel(obj[key]);
        return acc;
      }, {});
    }
    return obj;
  }


  const handleUpload = async () => {
    if (!jsonData) return;

    try {
      setStatus(`Uploading ${selectedApi}...`);

      for (const row of jsonData) {
        const item = JSON.parse(JSON.stringify(row)) as typeof API_TYPES[typeof selectedApi];
        // Only check for duplicates if we're on items
        if (
          fetchedData.some((existing: any) => existing.name === item.name)
        ) {
          console.log(
            `${selectedApi} with name ${item.name} already exists, skipping upload.`
          );
          continue;
        }

        if (selectedApi === "abilitiesRequiredItems") {
          const reqAbility = abilities?.find((a) => a.name === item.name);
          const modifiedItem = {
            ...item,
            itemTree: item.requiredItem,
            abilityId: reqAbility?.id
          }
          const res = await API[selectedApi][`${selectedApi}Post`]({
            [selectedApi]: modifiedItem,
          });
          console.log("API response:", res);

        } else if (selectedApi === "abilitiesRequiredLevels") {
          const reqSkill = skills?.find((s) => s.name === item.requiredSkill);
          const reqAbility = abilities?.find((a) => a.name === item.name);
          const modifiedItem = {
            ...item,
            skillId: reqSkill?.id,
            abilityId: reqAbility?.id
          }
          const res = await API[selectedApi][`${selectedApi}Post`]({
            [selectedApi]: modifiedItem,
          });
          console.log("API response:", res);
        } else {
          // @ts-expect-error: dynamic call
          const res = await API[selectedApi][`${selectedApi}Post`]({
            [selectedApi]: item,
          });
          console.log("API response:", res);
        }
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
