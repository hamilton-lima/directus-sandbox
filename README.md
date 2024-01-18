# Directus Sandbox
This is a collection of assets and solutions to Directus real life problems 

## How to deploy to other environments WITHOUT Risking data loss?
How to deploy Data models, Flows and Access controls definitions to other environments in a automated way. a.k.a. How to deploy to a staging environment before deploying to a production environment.

My first attempt was to dump a snapshot of the database to a file and apply when starting Directus, see below how, but this solution was too easy to REMOVE collections and LOOSE data! Just by starting to test it we deleted by accident a collection in Staging environment, so that is a no go.

The scripts created only create collections and add fields if they don't exist in existing collections, no collection removal, no field type updates, no field removal as well. The plan is if you need to remove data, do it by creating a script, or manually so the risk of loosing data is minimum.

# Features
- download-collections, saves each collection definition to files in a `collections` folder.
- upload-collections, read each .json file from `collections` folder and call directus APIs to create the - download-flows, saves each collection definition to files in a `collections` folder.
- upload-collections, read each .json file from `collections` folder and call directus APIs to create the 

## Download database snapshot and apply when starting Directus 

THIS SOLUTION WILL REMOVE COLLECTIONS THAT ARE NOT PRESENT IN THE SNAPSHOT, USE AT YOUR OWN RISK.

### Script to save snapshot
This script will save a file in the current folder with the schema definition of the Directus collections
```
#!/bin/bash
docker exec -it directus npx directus schema snapshot /directus/snapshots/schema.yml
docker cp directus:/directus/snapshots/schema.yml .
```

### Apply the schema to an instance

Include the line `&& node cli.js schema apply --yes /directus/schema.yml \` before starting Directus with `pm2`
```
FROM directus/directus:10.8.1

CMD : \
    && node cli.js bootstrap \
    && node cli.js schema apply --yes /directus/schema.yml \
    && pm2-runtime start ecosystem.config.cjs \
    ;
```
