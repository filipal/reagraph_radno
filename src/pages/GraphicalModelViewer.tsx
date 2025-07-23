/**
 * GraphicalModelViewer.tsx
 *
 * Glavna stranica za vizualizaciju modeliranih IT sustava.
 * - Omogućuje učitavanje više JSON datoteka i spajanje njihovih podataka u jedan graf.
 * - Parsira i konvertira JSON u prikladan format (`GraphData`) za prikaz u Reagraph komponenti.
 * - Prikazuje korisničko sučelje s navigacijskim gumbima i Reagraph platnom.
 * - Kompatibilna s datotekama tipa `File`, `FileItem` i `string` sadržajima.
 *
 * Ova komponenta je rezultat integracije dva projekta — originalnog JSON-parsing prikaza
 * i novog vizualnog editora temeljenog na Reagraph-u.
 */

// TODO:
// - Implementirati undo/redo funkcionalnost unutar prikaza grafa (moguće pomoću `useGraph` hooka).
// - Dodati gumb za spremanje izmijenjenog grafa u JSON (npr. kao preuzimanje fajla ili spremanje u localStorage).
// - Povezati stanje prikazanog grafa sa spremištem izmjena (za razliku između originalnog i modificiranog).
// - Podesiti layout gumba (Landscape, Credentials itd.) ako budu povezani s filtrima grafa.
// - Razmisliti treba li GraphicalModelViewer ostati kao posredna komponenta ili se preusmjeravanje može pojednostaviti.


import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useGraph } from '../hooks/useGraph';
import styles from "./graphicalmodelviewer.module.scss";
import GraphCanvasComponent from "../components/GraphCanvas";
import { parseJSONToGraph } from "../services/JSONParser";
import { filterFirewallsGraph } from "../graphModes/firewalls";
import { filterDataservicesGraph } from '../graphModes/dataservices';
import { filterCredentialsGraph } from '../graphModes/credentials';
import type { GraphData, FileItem } from "../types";

function mergeRawJsons(raws: any[]): any {
  if (!raws || raws.length === 0) return null;

  const merged = { computers: {}, credentials: {}, data: {}, ...raws[0] };
  for (const raw of raws) {
    if (raw.computers) Object.assign(merged.computers, raw.computers);
    if (raw.credentials) Object.assign(merged.credentials, raw.credentials);
    if (raw.firewall_rules) merged.firewall_rules = raw.firewall_rules; // ➡️ dodano direktno
    if (raw.data) Object.assign(merged.data, raw.data);
  }
  return merged;
}

function mergeGraphs(graphs: GraphData[]): GraphData {
  const merged: GraphData = {
    nodes: [],
    edges: [],
  };

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const graph of graphs) {
    for (const node of graph.nodes) {
      if (!nodeIds.has(node.id)) {
        merged.nodes.push(node);
        nodeIds.add(node.id);
      }
    }
    for (const edge of graph.edges) {
      if (!edgeIds.has(edge.id)) {
        merged.edges.push(edge);
        edgeIds.add(edge.id);
      }
    }
  }

  return merged;
}

export default function GraphicalModelViewer() {
  const navigate = useNavigate();
  const location = useLocation();
  const files = (location.state?.files || []) as FileItem[];

  const outputJsonFromState = location.state?.outputJson;
  const inputJsonFromState = location.state?.inputJson;

  const [selectedGroup, setSelectedGroup] = useState<string>(''); 
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const [mode, setMode] = useState<'landscape' | 'firewalls' | 'dataservices' | 'credentials'>('landscape');
  const [mergedRaw, setMergedRaw] = useState<any>(null);
  const { setEditableJson } = useSession();
  const { graphData, setGraphData } = useSession();
useEffect(() => {
  const readFiles = async () => {
    try {
      // ➡️ Logika za jedan file (iz handleEdit)
      if (outputJsonFromState && inputJsonFromState) {
        console.log("✅ Using single outputJson and inputJson from location.state");

        const graph = parseJSONToGraph(outputJsonFromState, inputJsonFromState);
        const mergedData = { ...outputJsonFromState, ...inputJsonFromState };
        setGraphData(graph);
        setMergedRaw(mergedData);
        setEditableJson(mergedData);
      
      // ➡️ Logika za više fileova (iz handleViewAllInGraph)
      } else if (files.length > 0) {
        console.log("✅ Using multiple files from location.state");
        const results = await Promise.all(
          files.map((file) =>
            new Promise<{ graph: GraphData; raw: any }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const json = JSON.parse(reader.result as string);
                  // Pretpostavka: svaki fajl je i input i output za sebe dok se ne spoji
                  const graph = parseJSONToGraph(json, json);
                  resolve({ graph, raw: json });
                } catch (err) {
                  reject(err);
                }
              };
              reader.onerror = reject;
              if (file instanceof File) {
                reader.readAsText(file);
              } else if (typeof file === "object" && "fileObject" in file && file.fileObject instanceof File) {
                reader.readAsText(file.fileObject);
              } else if (typeof file === "object" && "content" in file && typeof file.content === "string") {
                reader.readAsText(new Blob([file.content]));
              } else {
                reject(new Error("Nepoznat format file objekta"));
              }
            })
          )
        );

        if (results.length > 0) {
          const mergedGraph = mergeGraphs(results.map((r) => r.graph));
          const mergedRawData = mergeRawJsons(results.map((r) => r.raw));

          if (!mergedRawData) {
            console.error("❌ Merged raw data is null.");
            return;
          }

          setMergedRaw(mergedRawData);
          setEditableJson(mergedRawData);
          setGraphData(mergedGraph);
        }
      }
    } catch (err) {
      console.error("❌ Error loading files or parsing JSON:", err);
    }
  };

  // Pokreni čitanje samo ako ima potrebnih podataka
  if ((outputJsonFromState && inputJsonFromState) || files.length > 0) {
    readFiles();
  }
}, [files, outputJsonFromState, inputJsonFromState]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Graphical Model View</h2>
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.modeButton} ${mode === 'landscape' ? styles.activeButton : ''}`}
            onClick={() => setMode('landscape')}
          >
            Landscape
          </button>
          <button
            className={`${styles.modeButton} ${mode === 'credentials' ? styles.activeButton : ''}`}
            onClick={() => setMode('credentials')}
          >
            Credentials
          </button>
          <button
            className={`${styles.modeButton} ${mode === 'dataservices' ? styles.activeButton : ''}`}
            onClick={() => setMode('dataservices')}
          >
            Dataservices
          </button>
          <button
            className={`${styles.modeButton} ${mode === 'firewalls' ? styles.activeButton : ''}`}
            onClick={() => setMode('firewalls')}
          >
            Firewalls
          </button>
          <button className={styles.backButton} onClick={() => navigate("/dashboard")}>
            BACK TO JSON MANAGER
          </button>
        </div>
      </div>

      {graphData ? (
        <GraphCanvasComponent
          key={JSON.stringify(graphData)}
          data={graphData}
          inputJson={mergedRaw}
          viewMode={mode}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
        />
      ) : (
        <p style={{ padding: "1rem" }}>MODEL VIEW IS LOADING...</p>
      )}
    </div>
  );
}