# Directus Sandbox
This is a collection of assets and solutions to Directus real life problems 

## How to deploy to other environments WITHOUT Risking data loss?
How to deploy Data models, Flows and Access controls definitions to other environments in a automated way. a.k.a. How to deploy to a staging environment before deploying to a production environment.

My first attempt was to dump a snapshot of the database to a file and apply when starting Directus, see below how, but this solution was too easy to REMOVE collections and LOOSE data! Just by starting to test it we deleted by accident a collection in Staging environment, so that is a no go.

The scripts created only create collections and add fields if they don't exist in existing collections, no collection removal, no field type updates, no field removal as well. The plan is if you need to remove data, do it by creating a script, or manually so the risk of loosing data is minimum.

### Features
- download-collections, saves each collection definition to files in a `collections` folder.
- upload-collections, read each .json file from `collections` folder and call directus APIs to create the - download-flows, saves each collection definition to files in a `collections` folder.
- upload-collections, read each .json file from `collections` folder and call directus APIs to create the 

### How to use the scripts

- Go to the User admin page in directus: and copy the authentication token to be used in the command line. The token can be found at Admin options > Token 
- Use that token either in the command line as this example shows or `export DIRECTUS_AUTH_TOKEN=...` then execute the command
- The last parameter is the Directus instance you want to download or upload items to

```
cd scripts
DIRECTUS_AUTH_TOKEN=ve5CprSuperSecret6A5C@Y0uR3adllKwCBE node download-collections.js http://localhost:8055
```
