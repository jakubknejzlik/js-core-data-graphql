const fs = require("fs");
const CoreData = require("js-core-data");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const lib = require("../index");
const seed = require("./seed");

const database = new CoreData("sqlite://:memory:");
database.createModelFromYaml(fs.readFileSync(__dirname + "/schema.yml"));

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.post("/graphql", lib.graphql(database));
app.get("/graphql", lib.graphiql());

const port = process.env.PORT || 3000;
seed(database).then(() => {
  console.log("database seeded");
  app.listen(port, err => {
    console.log(`listening on ${port}, err: ${err}`);
  });
});
