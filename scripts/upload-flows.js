import fetch from "node-fetch";
import path from "path";
import { readdir, readFile } from "fs/promises";

const DIRECTUS_URL = process.argv[2];
const AUTH_TOKEN = process.env.DIRECTUS_AUTH_TOKEN;
const FLOWS_DIR = "./flows";

if (!DIRECTUS_URL || !AUTH_TOKEN) {
  console.error(
    "Please provide the Directus URL as a command line argument and set the DIRECTUS_AUTH_TOKEN environment variable."
  );
  process.exit(1);
}

let existingFlows = new Map();

async function fetchAllFlows() {
  const flowsEndpoint = `${DIRECTUS_URL}/flows`;
  const response = await fetch(flowsEndpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch flows: ${response.status}`);
  }

  const flowsData = await response.json();

  if (flowsData && Array.isArray(flowsData.data)) {
    flowsData.data.forEach((flow) => existingFlows.set(flow.id, flow));

    console.log("Existing flows found:");
    existingFlows.forEach((value, key) => {
      console.log(`Flow ID: ${key}, Flow Name: ${value.name}, Value:`, value);
    });
  }
}

function sortOperations(operations) {
  const operationMap = new Map();
  operations.forEach((op) => {
    operationMap.set(op.id, op);
  });

  const sortedOperations = [];
  const addOperation = (operationId) => {
    const operation = operationMap.get(operationId);
    if (!operation) return;

    // Add dependency operations first
    if (operation.resolve && operationMap.has(operation.resolve)) {
      addOperation(operation.resolve);
    }
    if (operation.reject && operationMap.has(operation.reject)) {
      addOperation(operation.reject);
    }

    // Add this operation if it hasn't been added yet
    if (!sortedOperations.includes(operation)) {
      sortedOperations.push(operation);
    }
  };

  operations.forEach((op) => addOperation(op.id));

  return sortedOperations;
}

async function uploadFlow(flow) {
  let flowEndpoint = `${DIRECTUS_URL}/flows/${flow.id}`;
  let method = "PATCH";
  const flowOperations = flow.operations;
  delete flow.operations;
  delete flow.user_created;

  if (!existingFlows.has(flow.id)) {
    console.log(
      `Flow ${flow.name} (ID: ${flow.id}) does NOT exist, will CREATE`
    );
    flowEndpoint = `${DIRECTUS_URL}/flows`;
    method = "POST";
  } else {
    console.log(`Flow ${flow.name} (ID: ${flow.id}) EXISTS, will UPDATE`);
  }

  const flowResponse = await fetch(flowEndpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify(flow),
  });

  if (!flowResponse.ok) {
    throw new Error(
      `Failed to upload flow ${flow.name} (ID: ${flow.id}): ${flowResponse.status}`
    );
  }

  const sortedFlowOperations = sortOperations(flowOperations);

  for (const operation of sortedFlowOperations) {
    await uploadOperation(flow.id, flow.name, operation, flowOperations);
  }
}

function findOperation(flowId, operationId) {
  console.log(
    `findOperation() - Checking operation (ID: ${operationId}) in flow (ID: ${flowId})`
  );
  if (existingFlows.has(flowId)) {
    const flow = existingFlows.get(flowId);
    console.log(
      `findOperation() - Flow found (ID: ${flowId}). Checking operations...`
    );

    const operations = flow.operations;
    if (operations && Array.isArray(operations)) {
      console.log(
        `findOperation() - Operations array found in flow (ID: ${flowId}). Operations:`,
        operations
      );

      const operationExists = operations.includes(operationId);
      console.log(
        `findOperation() - Operation ${
          operationExists ? "exists" : "does not exist"
        } (ID: ${operationId}) in flow (ID: ${flowId})`
      );
      return operationExists;
    } else {
      console.log(
        `findOperation() - No operations array found in flow (ID: ${flowId}).`
      );
    }
  } else {
    console.log(`findOperation() - No flow found with ID: ${flowId}`);
  }
  return false;
}

async function uploadOperation(flowId, flowName, operation, allOperations) {
  let operationEndpoint = `${DIRECTUS_URL}/operations/${operation.id}`;
  let method = "PATCH";

  if (
    operation.reject &&
    !allOperations.some((op) => op.id === operation.reject)
  ) {
    console.log(
      `Reject field in operation ${operation.name} (ID: ${operation.id}) of flow ${flowName} (ID: ${flowId}) does not refer to an existing operation. Skipping upload.`
    );
    return;
  }

  delete operation.user_created;

  const operationExists = findOperation(flowId, operation.id);

  if (!operationExists) {
    console.log(
      `Operation ${operation.name} (ID: ${operation.id}) in flow ${flowName} (ID: ${flowId}) does NOT exist, will CREATE`
    );
    operationEndpoint = `${DIRECTUS_URL}/operations`;
    method = "POST";
  } else {
    console.log(
      `Operation ${operation.name} (ID: ${operation.id}) in flow ${flowName} (ID: ${flowId}) EXISTS, will UPDATE`
    );
  }

  operation.flow = flowId;

  const operationResponse = await fetch(operationEndpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify(operation),
  });

  if (!operationResponse.ok) {
    throw new Error(
      `Failed to upload operation ${operation.name} (ID: ${operation.id}): ${operationResponse.status}`
    );
  }
}

async function processFlows() {
  try {
    await fetchAllFlows();

    const files = await readdir(FLOWS_DIR);

    for (const file of files) {
      if (path.extname(file) === ".json") {
        try {
          const content = await readFile(`${FLOWS_DIR}/${file}`, "utf8");
          const flow = JSON.parse(content);
          await uploadFlow(flow);
          console.log(`Successfully processed flow from file: ${file}`);
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
        }
      } else {
        console.log(`Skipping non-JSON file ${file}`);
      }
    }

    console.log("All flow files have been processed.");
  } catch (error) {
    console.error("Error:", error);
  }
}

processFlows();
