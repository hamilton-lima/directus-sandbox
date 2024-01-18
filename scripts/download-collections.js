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

const API_ENDPOINT = `${DIRECTUS_URL}/collections`;
const COLLECTIONS_DIR = "./collections";

// Create the collections directory if it does not exist
if (!existsSync(COLLECTIONS_DIR)) {
  await mkdir(COLLECTIONS_DIR);
}

async function fetchFields(collectionId) {
  const fieldsEndpoint = `${DIRECTUS_URL}/fields/${collectionId}`;
  try {
    const response = await fetch(fieldsEndpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(
        `Error fetching fields for collection ${collectionId}: ${response.status}`
      );
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

async function fetchRelations(collectionId) {
  const relationsEndpoint = `${DIRECTUS_URL}/relations/${collectionId}`;
  try {
    const response = await fetch(relationsEndpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(
        `Error fetching relations for collection ${collectionId}: ${response.status}`
      );
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

async function fetchCollections() {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const collectionsData = await response.json();
    const collections = collectionsData.data;

    for (let collection of collections) {
      // Skip collections where meta.system is true
      if (collection.meta && collection.meta.system) {
        console.log(`Skipping system collection: ${collection.collection}`);
        continue;
      }

      // Fetch fields only if collection.schema is not null
      if (collection.schema !== null) {
        const fields = await fetchFields(collection.collection);
        collection.fields = fields;

        // Fetch and add relations to the collection
        const relations = await fetchRelations(collection.collection);
        collection.relations = relations;
      }

      // Save each collection to a separate file in the collections directory
      await writeFile(
        `${COLLECTIONS_DIR}/${collection.collection}.json`,
        JSON.stringify(collection, null, 2)
      );

      console.log(`Collection processed: ${collection.collection}`);
    }

    console.log("All collections processed.");
  } catch (error) {
    console.error("Failed to fetch collections:", error);
  }
}

fetchCollections();
