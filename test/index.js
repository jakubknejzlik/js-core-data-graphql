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
    return database.syncSchema({force: true}).then(() => {
      const context = database.createContext();

      context.create("Company", {name: "test"});
      context.create("Company", {name: "test2"});
      context.create("Company", {name: "test3"});

      context.create("Person", {firstname: "john", lastname: "Doe"});
      context.create("Person", {firstname: "Jane", lastname: "Siri"});

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

  it("create a company", () => {
    let postData = {
      query: `mutation createCompany($input:  CompanyInputType){
                createCompany(input: $input){
                  id,
                  name
                }
            }`,
      variables: {
        input: {
          name: 'Company A'
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.createCompany.name, "Company A");
      });
  })

  it("create a person", () => {
    let postData = {
      query: `mutation createPerson($input:  PersonInputType){
                createPerson(input: $input){
                  id,
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                }
            }`,
      variables: {
        input: {
          firstname: 'FN',
          lastname: 'LN',
          age: 20,
          salary: 20,
          birthdate: new Date('01/01/2017')
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.createPerson.firstname, "FN");
        assert.equal(res.body.data.createPerson.lastname, "LN");
        assert.equal(res.body.data.createPerson.age, 20);
        assert.equal(res.body.data.createPerson.salary, 20);
        assert.equal(res.body.data.createPerson.birthdate, new Date('01/01/2017'));
      });
  });

  it("update a company", () => {
    let postData = {
      query: `mutation updateCompany($input:  CompanyInputUpdateType){
                updateCompany(input: $input){
                  id,
                  name
                }
            }`,
      variables: {
        input: {
          id: 1,
          name: 'Company A'
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.updateCompany.id, 1);
        assert.equal(res.body.data.updateCompany.name, "Company A");
      }).then(() => {
        return test
          .get(`/graphql?query={getCompany(id:1){id, name}}`)
          .expect(200)
          .then(res => {
            assert.equal(res.body.data.getCompany.id, 1);
            assert.equal(res.body.data.getCompany.name, "Company A");
          });
      });
  })

  it("update a person", () => {
    let postData = {
      query: `mutation updatePerson($input:  PersonInputUpdateType){
                updatePerson(input: $input){
                  id,
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                }
            }`,
      variables: {
        input: {
          id: 1,
          firstname: 'FN',
          lastname: 'LN',
          age: 20,
          salary: 20,
          birthdate: new Date('01/02/2017')
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.updatePerson.id, 1);
        assert.equal(res.body.data.updatePerson.firstname, "FN");
        assert.equal(res.body.data.updatePerson.lastname, "LN");
        assert.equal(res.body.data.updatePerson.age, 20);
        assert.equal(res.body.data.updatePerson.salary, 20);
        assert.equal(res.body.data.updatePerson.birthdate, new Date('01/02/2017'));
      }).then(() => {
        return test
          .get(`/graphql?query={getPerson(id:1){id, firstname, lastname, age, salary, birthdate}}`)
          .expect(200)
          .then(res => {
            assert.equal(res.body.data.getPerson.id, 1);
            assert.equal(res.body.data.getPerson.firstname, "FN");
            assert.equal(res.body.data.getPerson.lastname, "LN");
            assert.equal(res.body.data.getPerson.age, 20);
            assert.equal(res.body.data.getPerson.salary, 20);
            assert.equal(res.body.data.getPerson.birthdate, new Date('01/02/2017'));
          });
      });
  })
});
