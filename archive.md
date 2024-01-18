# Archived 

## Download database snapshot and apply when starting Directus -

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
