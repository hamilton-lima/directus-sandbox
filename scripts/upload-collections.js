import fetch from "node-fetch";
import { readdir, readFile } from "fs/promises";
import path from "path";

const DIRECTUS_URL = process.argv[2];
const AUTH_TOKEN = process.env.DIRECTUS_AUTH_TOKEN;
const COLLECTIONS_DIR = "./collections";

if (!DIRECTUS_URL || !AUTH_TOKEN) {
  console.error(
    "Please ensure the Directus URL is provided as a command line argument and the DIRECTUS_AUTH_TOKEN is set."
  );
  process.exit(1);
}

async function fetchExistingCollections() {
  try {
    const response = await fetch(`${DIRECTUS_URL}/collections`, {
      method: "GET",
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch collections: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data.map((collection) => collection.collection);
  } catch (error) {
    console.error(`Error fetching existing collections: ${error}`);
    return [];
  }
}

async function fetchExistingFields(collectionName) {
  try {
    const response = await fetch(`${DIRECTUS_URL}/fields/${collectionName}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!response.ok) {
      console.error(
        `HTTP error fetching fields for ${collectionName}: ${response.statusText}`
      );
      return [];
    }
    const data = await response.json();
    return data.data.map((field) => field.field);
  } catch (error) {
    console.error(`Error fetching fields for ${collectionName}: ${error}`);
    return [];
  }
}

async function fetchExistingRelations(collectionName) {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/relations/${collectionName}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      }
    );
    if (!response.ok) {
      console.error(
        `HTTP error fetching relations for ${collectionName}: ${response.statusText}`
      );
      return [];
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`Error fetching relations for ${collectionName}: ${error}`);
    return [];
  }
}

async function resetDirectusCache() {
  try {
    const response = await fetch(`${DIRECTUS_URL}/utils/cache/clear`, {
      method: "POST",
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to reset cache: ${response.statusText}`);
    }

    console.log("Cache reset successfully.");
  } catch (error) {
    console.error(`Error resetting cache: ${error}`);
  }
}

async function createCollection(collection) {
  if (collection.fields) {
    for (let field of collection.fields) {
      if (field.meta && field.meta.id) {
        delete field.meta.id;
      }
    }
  }

  try {
    const response = await fetch(`${DIRECTUS_URL}/collections`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(collection),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to create collection ${collection.collection}: ${response.statusText}`
      );
    }
    console.log(`Created collection: ${collection.collection}`);
  } catch (error) {
    console.error(
      `Error creating collection ${collection.collection}: ${error}`
    );
  }
}

async function createFieldsForCollection(collectionName, fields) {
  for (let field of fields) {
    if (field.meta && field.meta.id) {
      delete field.meta.id;
    }
    try {
      const response = await fetch(`${DIRECTUS_URL}/fields/${collectionName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(field),
      });
      if (!response.ok) {
        throw new Error(
          `Failed to create field ${field.field} in ${collectionName}: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(
        `Error creating field ${field.field} in ${collectionName}: ${error}`
      );
    }
  }
}

async function createRelationsForCollection(collectionName, relations) {
  const existingRelations = await fetchExistingRelations(collectionName);

  for (let relation of relations) {
    let relationExists = false;

    for (let existingRelation of existingRelations) {
      if (
        existingRelation.field === relation.field &&
        existingRelation.related_collection === relation.related_collection
        // Add any other checks for attributes that define your relations uniquely
      ) {
        relationExists = true;
        break; // Exit the loop if the relation is found
      }
    }

    if (!relationExists) {
      try {
        const response = await fetch(`${DIRECTUS_URL}/relations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(relation),
        });
        if (!response.ok) {
          throw new Error(
            `Failed to create relation in ${collectionName}: ${response.statusText}`
          );
        }
      } catch (error) {
        console.error(`Error creating relation in ${collectionName}: ${error}`);
      }
    }
  }
}

async function uploadCollections() {
  const existingCollections = await fetchExistingCollections();
  const relationsToCreate = [];

  const files = await readdir(COLLECTIONS_DIR);
  for (const file of files) {
    const filePath = path.join(COLLECTIONS_DIR, file);
    const fileContents = await readFile(filePath, "utf8");
    const collection = JSON.parse(fileContents);

    if (!existingCollections.includes(collection.collection)) {
      await createCollection(collection);
    }

    if (collection.fields) {
      const existingFields = await fetchExistingFields(collection.collection);
      const fieldsToCreate = collection.fields.filter(
        (field) => !existingFields.includes(field.field)
      );

      if (fieldsToCreate.length > 0) {
        await createFieldsForCollection(collection.collection, fieldsToCreate);
      }
    }

    if (collection.relations) {
      // Store relations to create later
      relationsToCreate.push({
        collectionName: collection.collection,
        relations: collection.relations,
      });
    }
  }

  // Create relations after all collections and fields have been processed
  for (const { collectionName, relations } of relationsToCreate) {
    await createRelationsForCollection(collectionName, relations);
  }

  console.log("All collections and relations processed.");
}

async function main() {
  try {
    await resetDirectusCache();
    await uploadCollections();
  } catch (error) {
    console.error(error);
    console.error(`Error in main execution: ${error}`);
  }
}

main();
