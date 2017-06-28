# js-core-data-graphql
Authorization middleware for js-core-data

# Example

```
const CoreData = require("js-core-data");
const express = require('express');
const CoreDataAuth = require('js-core-data-auth');

const database = new CoreData(databaseUrl);
const app = express();

app.use(CoreDataAuth.auth(database));

app.listen(3000)
```
