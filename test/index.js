const assert = require("assert");
const fs = require("fs");
const CoreData = require("js-core-data");
const supertest = require("supertest");
const express = require("express");

const lib = require("../index");

const database = new CoreData("sqlite://:memory:");
database.createModelFromYaml(fs.readFileSync(__dirname + "/schema.yml"));

const app = express();
app.use("/graphql", lib.graphql(database));

const test = supertest(app);

describe("graphql", () => {
  beforeEach(() => {
    return database.syncSchema({ force: true }).then(() => {
      const context = database.createContext();

      context.create("Company", { name: "test" });
      context.create("Company", { name: "test2" });
      context.create("Company", { name: "test3" });

      context.create("Person", { firstname: "john", lastname: "Doe" });
      context.create("Person", { firstname: "Jane", lastname: "Siri" });

      return context.save();
    });
  });

  it("should get companies", () => {
    return test
      .get(`/graphql?query={getCompanies{name}}`)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.getCompanies.length, 3);
      });
  });
  it("should get people", () => {
    return test
      .get(`/graphql?query={getPeople{firstname}}`)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.getPeople.length, 2);
      });
  });
});
