const assert = require("assert");
const Router = require("express").Router;
const apolloServer = require("apollo-server-express");

const schema = require("./graphql.schema.js");

if (process.env.APOLLO_ENGINE_KEY) {
  const apolloEngine = require("apollo-engine");
  const engine = new apolloEngine.Engine({
    engineConfig: {
      apiKey: process.env.APOLLO_ENGINE_KEY
    }
  });
  engine.start();
}

module.exports = (database, options) => {
  assert.ok(database.model, "database has no model defined");

  const app = new Router();
  const modelSchema = schema.getSchemaFromModel(database.model);

  app.use(database.middleware());

  app.use(
    "/",
    apolloServer.graphqlExpress(req => {
      return {
        context: req,
        schema: modelSchema,
        tracing: true,
        cacheControl: true
      };
    })
    // server.graphqlExpress(req => {
    //   return {
    //     context: req,
    //     schema: modelSchema
    //   };
    // })
  );

  return app;
};
