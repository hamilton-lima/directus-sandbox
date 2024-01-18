import fetch from "node-fetch";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const DIRECTUS_URL = process.argv[2];
const AUTH_TOKEN = process.env.DIRECTUS_AUTH_TOKEN;

if (!DIRECTUS_URL || !AUTH_TOKEN) {
  console.error(
    "Please ensure the Directus URL is provided as a command line argument and the DIRECTUS_AUTH_TOKEN is set."
  );
  process.exit(1);
}

const API_ENDPOINT = `${DIRECTUS_URL}/flows`;
const FLOWS_DIR = "./flows";

// Create the flows directory if it does not exist
if (!existsSync(FLOWS_DIR)) {
  await mkdir(FLOWS_DIR);
}

async function fetchOperations(flowId) {
  const operationsEndpoint = `${DIRECTUS_URL}/operations?filter[flow]=${flowId}`;
  try {
    const response = await fetch(operationsEndpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(
        `Error fetching operations for flow ${flowId}: ${response.status}`
      );
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

async function fetchFlows() {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const flowsData = await response.json();
    const flows = flowsData.data;

    for (let flow of flows) {
      const operations = await fetchOperations(flow.id);
      flow.operations = operations;

      // Save each flow to a separate file in the flows directory
      await writeFile(
        `${FLOWS_DIR}/${flow.id}.json`,
        JSON.stringify(flow, null, 2)
      );
    }

    console.log("All flows saved to individual files in 'flows' directory.");
  } catch (error) {
    console.error("Failed to fetch flows:", error);
  }
}

fetchFlows();
