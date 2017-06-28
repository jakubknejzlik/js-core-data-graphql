const assert = require("assert");
const server = require("graphql-server-express");
const Router = require("express").Router;

const schema = require("./graphql.schema.js");

module.exports = (database, options) => {
  assert.ok(database.model, "database has no model defined");

  const app = new Router();
  const modelSchema = schema.getSchemaFromModel(database.model);

  app.use(database.middleware());

  app.use(
    "/",
    server.graphqlExpress(req => {
      return {
        context: req,
        schema: modelSchema
      };
    })
  );

  return app;
};
