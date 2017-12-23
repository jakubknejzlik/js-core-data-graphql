const { expressPlayground } = require("graphql-playground-middleware");

const GRAPHQL_API_PATH = process.env.GRAPHQL_API_PATH || "/graphql";

module.exports = (database, options) => {
  return expressPlayground({ endpoint: GRAPHQL_API_PATH });
};
