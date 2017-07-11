const assert = require("assert");
const fs = require("fs");
const CoreData = require("js-core-data");
const supertest = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");

const lib = require("../index");

const database = new CoreData("sqlite://:memory:");
database.createModelFromYaml(fs.readFileSync(__dirname + "/schema.yml"));

const app = express();
app.use(bodyParser.json());
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

  it("should get a company", () => {
    return test
      .get(`/graphql?query={getCompany(id:1){id}}`)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.getCompany.id, 1);
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

  it("should get person", () => {
    return test
      .get(`/graphql?query={getPerson(id:1){id}}`)
      .expect(200)
      .then(res => {
        console.log(JSON.stringify(res.body));
        assert.equal(res.body.data.getPerson.id, 1);
      });
  })

  it("delete a company by id", () => {
    let postData = {
      query: `mutation deleteCompany($id: Int){
                deleteCompany(id: $id){
                    id
                    name
                    employees{
                      id
                    }
                }
            }`,
      variables: {
        id: 1
      }
    };

    //need to start the server example to run this test
    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.deleteCompany.id, 1);
      });
  });

  it("delete a person by id", () => {
    let postData = {
      query: `mutation deletePerson($id: Int){
                deletePerson(id: $id){
                  id,
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                }
            }`,
      variables: {
        id: 1
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.deletePerson.id, 1);
      });
  });
});
