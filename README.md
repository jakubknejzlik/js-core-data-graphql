# js-core-data-graphql

[![Build Status](https://travis-ci.org/jakubknejzlik/js-core-data-graphql.svg?branch=master)](https://travis-ci.org/jakubknejzlik/js-core-data-graphql)

GraphQL endpoint generator for js-core-data

# Example

```
const express = require("express");
const bodyParser = require("body-parser");

const CoreData = require("js-core-data");
const CoreDataGraphql = require("js-core-data-graphql");

const database = new CoreData("sqlite://:memory:");
// setup your schema

const app = express();

app.use(bodyParser.json());
app.post("/graphql", CoreDataGraphql.graphql(database));
app.get("/graphql", CoreDataGraphql.graphiql());

app.listen(3000);
```
