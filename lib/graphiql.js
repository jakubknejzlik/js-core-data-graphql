const server = require("graphql-server-express");

module.exports = (database, options) => {
  return server.graphiqlExpress({ endpointURL: "/graphql" });
};
