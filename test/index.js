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
      context.create("Company", { name: "test4" });
      context.create("Company", { name: "test5" });
      context.create("Company", { name: "test6" });
      context.create("Company", { name: "test7" });
      context.create("Company", { name: "test8" });

      context.create("Person", { firstname: "john", lastname: "Doe" });
      context.create("Person", { firstname: "Jane", lastname: "Siri" });
      context.create("Person", { firstname: "FN 3", lastname: "LN 3" });
      context.create("Person", { firstname: "FN 4", lastname: "LN 4" });
      context.create("Person", { firstname: "FN 5", lastname: "LN 5" });
      context.create("Person", { firstname: "FN 6", lastname: "LN 6" });
      context.create("Person", { firstname: "FN 7", lastname: "LN 7" });
      context.create("Person", { firstname: "FN 8", lastname: "LN 8" });

      return context.save();
    });
  });

  it("should get companies", () => {
    const postData = {
      query: `query getComanies($sort: [CompanySortType!]){
        getCompanies( sort: $sort){
          id,
          name,
          employees {
            id
          }
        }
      }`,
      variables: {
        sort: ["ID"]
      }
    };
    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        const length = res.body.data.getCompanies.length;
        assert.equal(length, 8);
        assert.equal(res.body.data.getCompanies[0].id, 1);
        assert.equal(res.body.data.getCompanies[length - 1].id, 8);
      });
  });

  it("should get companies with paging - offset: 3, limit: 3", () => {
    return test
      .get(`/graphql?query={getCompanies(offset: 3, limit: 3){name}}`)
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
    const postData = {
      query: `query getPeople($sort: [PersonSortType!]){
        getPeople( sort: $sort){
          id,
          firstname,
          lastname,
          age,
          salary,
          birthdate
        }
      }`,
      variables: {
        sort: ["ID"]
      }
    };
    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        const length = res.body.data.getPeople.length;
        assert.equal(length, 8);
        assert.equal(res.body.data.getPeople[0].id, 1);
        assert.equal(res.body.data.getPeople[length - 1].id, 8);
      });
  });

  it("should get people with paging - offset: 3, limit: 3", () => {
    return test
      .get(`/graphql?query={getPeople(offset: 3, limit: 3){firstname}}`)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.getPeople.length, 3);
      });
  });

  it("should get person", () => {
    return test
      .get(`/graphql?query={getPerson(id:1){id}}`)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.getPerson.id, 1);
      });
  });

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
      query: `mutation createCompany($input:  CompanyCreateInputType){
                createCompany(input: $input){
                  name
                }
            }`,
      variables: {
        input: {
          name: "Company A"
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
  });

  it("create a person", () => {
    let postData = {
      query: `mutation createPerson($input:  PersonCreateInputType){
                createPerson(input: $input){
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                }
            }`,
      variables: {
        input: {
          firstname: "FN",
          lastname: "LN",
          age: 20,
          salary: 20,
          birthdate: new Date("01/01/2017")
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
        assert.equal(
          res.body.data.createPerson.birthdate,
          new Date("01/01/2017")
        );
      });
  });

  it("update a company", () => {
    let postData = {
      query: `mutation updateCompany($input:  CompanyUpdateInputType){
                updateCompany(input: $input){
                  id,
                  name
                }
            }`,
      variables: {
        input: {
          id: 1,
          name: "Company A"
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
      })
      .then(() => {
        return test
          .get(`/graphql?query={getCompany(id:1){id, name}}`)
          .expect(200)
          .then(res => {
            assert.equal(res.body.data.getCompany.id, 1);
            assert.equal(res.body.data.getCompany.name, "Company A");
          });
      });
  });

  it("update a person", () => {
    let postData = {
      query: `mutation updatePerson($input:  PersonUpdateInputType){
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
          firstname: "FN",
          lastname: "LN",
          age: 20,
          salary: 20,
          birthdate: new Date("01/02/2017")
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
        assert.equal(
          res.body.data.updatePerson.birthdate,
          new Date("01/02/2017")
        );
      })
      .then(() => {
        return test
          .get(
            `/graphql?query={getPerson(id:1){id, firstname, lastname, age, salary, birthdate}}`
          )
          .expect(200)
          .then(res => {
            assert.equal(res.body.data.getPerson.id, 1);
            assert.equal(res.body.data.getPerson.firstname, "FN");
            assert.equal(res.body.data.getPerson.lastname, "LN");
            assert.equal(res.body.data.getPerson.age, 20);
            assert.equal(res.body.data.getPerson.salary, 20);
            assert.equal(
              res.body.data.getPerson.birthdate,
              new Date("01/02/2017")
            );
          });
      });
  });

  it("create company and person in one mutation", () => {
    let postData = {
      query: `mutation ($person: PersonCreateInputType, $company: CompanyCreateInputType){
                createPerson(input: $person){
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                }
                createCompany(input: $company){
                  id,
                  name
                }
            }`,
      variables: {
        person: {
          firstname: "FN",
          lastname: "LN",
          age: 20,
          salary: 20,
          birthdate: new Date("01/01/2017")
        },
        company: {
          name: "Company A"
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
        assert.equal(
          res.body.data.createPerson.birthdate,
          new Date("01/01/2017")
        );
        assert.equal(res.body.data.createCompany.name, "Company A");
      });
  });

  it("update company and person in one mutation", () => {
    let postData = {
      query: `mutation ($person: PersonUpdateInputType, $company: CompanyUpdateInputType){
                updatePerson(input: $person){
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                }
                updateCompany(input: $company){
                  id,
                  name
                }
            }`,
      variables: {
        person: {
          id: 1,
          firstname: "AA",
          lastname: "BB",
          age: 20,
          salary: 20,
          birthdate: new Date("01/01/2017")
        },
        company: {
          id: 1,
          name: "Company B"
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.updatePerson.firstname, "AA");
        assert.equal(res.body.data.updatePerson.lastname, "BB");
        assert.equal(res.body.data.updatePerson.age, 20);
        assert.equal(res.body.data.updatePerson.salary, 20);
        assert.equal(
          res.body.data.updatePerson.birthdate,
          new Date("01/01/2017")
        );
        assert.equal(res.body.data.updateCompany.name, "Company B");
      });
  });
});
