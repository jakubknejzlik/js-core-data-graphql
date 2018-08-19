const assert = require('assert');
const fs = require('fs');
const CoreData = require('js-core-data');
const supertest = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');

const lib = require('../index');

const database = new CoreData('sqlite://:memory:');
database.createModelFromYaml(fs.readFileSync(__dirname + '/schema.yml'));

const app = express();
app.use(bodyParser.json());
app.post('/graphql', lib.graphql(database));
app.get('/graphql', lib.graphiql());

const test = supertest(app);

describe('graphql', () => {
  beforeEach(() => {
    return database.syncSchema({ force: true }).then(() => {
      const context = database.createContext();

      context.create('Company', { name: 'test' });
      context.create('Company', { name: 'test2' });
      context.create('Company', { name: 'test3' });
      context.create('Company', { name: 'test4' });
      context.create('Company', { name: 'test5' });
      context.create('Company', { name: 'test6' });
      context.create('Company', { name: 'test7' });
      context.create('Company', { name: 'test8' });

      context.create('Person', { firstname: 'john', lastname: 'Doe' });
      context.create('Person', { firstname: 'Jane', lastname: 'Siri' });
      context.create('Person', { firstname: 'FN 3', lastname: 'LN 3' });
      context.create('Person', { firstname: 'FN 4', lastname: 'LN 4' });
      context.create('Person', { firstname: 'FN 5', lastname: 'LN 5' });
      context.create('Person', { firstname: 'FN 6', lastname: 'LN 6' });
      context.create('Person', { firstname: 'FN 7', lastname: 'LN 7' });
      context.create('Person', { firstname: 'FN 8', lastname: 'LN 8' });

      return context.save();
    });
  });

  it('should get graphiql', () => {
    return test
      .get(`/graphql`)
      .expect(200)
      .then(res => {
        assert.ok(res.text.indexOf('<title>GraphQL Playground</title>') !== -1);
      });
  });

  it('should get companies', () => {
    const postData = {
      query: `query companies($sort: [CompanySortType!]){
        companies(sort: $sort, filter:{name:"test"}){
          items {
            id,
            name,
            employees {
              id
            }
          }
        }
      }`,
      variables: {
        sort: ['ID']
      }
    };
    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        const length = res.body.data.companies.items.length;
        assert.equal(length, 1);
        assert.equal(res.body.data.companies.items[0].id, 8);
        assert.equal(res.body.data.companies.items[length - 1].id, 8);
        assert.equal(res.body.data.companies.items[0].name, 'test');
      });
  });
  it('should get companies reversed', () => {
    const postData = {
      query: `query companies($sort: [CompanySortType!]){
        companies(sort: $sort){
          items {
            id,
            name,
            employees {
              id
            }
          }
        }
      }`,
      variables: {
        sort: ['ID_DESC', 'NAME']
      }
    };
    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        const length = res.body.data.companies.items.length;
        assert.equal(length, 8);
        assert.equal(res.body.data.companies.items[0].id, 8);
        assert.equal(res.body.data.companies.items[length - 1].id, 1);
      });
  });

  it('should get companies with paging - offset: 3, limit: 3', () => {
    return test
      .post(`/graphql`)
      .send({ query: `{companies(offset: 3, limit: 3){items{name}}}` })
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.companies.items.length, 3);
      });
  });

  it('should get a company', () => {
    return test
      .post(`/graphql`)
      .send({ query: `{company(id:1){id}}` })
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.company.id, 1);
      });
  });

  it('should get a company using filter', () => {
    return test
      .post(`/graphql`)
      .send({ query: `{company(filter:{name:"test"}){name}}` })
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.company.name, 'test');
      });
  });

  it('should get people', () => {
    const postData = {
      query: `query people($sort: [PersonSortType!]){
        people( sort: $sort){
          items{
            id,
            firstname,
            lastname,
            age,
            salary,
            birthdate
          }
          count
        }
      }`,
      variables: {
        sort: ['ID_DESC']
      }
    };
    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        const length = res.body.data.people.items.length;
        assert.equal(res.body.data.people.count, 8);
        assert.equal(length, 8);
        assert.equal(res.body.data.people.items[0].id, 8);
        assert.equal(res.body.data.people.items[length - 1].id, 1);
      });
  });

  it('should get people with paging - offset: 3, limit: 3', () => {
    return test
      .post(`/graphql`)
      .send({ query: `{people(offset: 3, limit: 3){items{firstname}}}` })
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.people.items.length, 3);
      });
  });

  it('should get person', () => {
    return test
      .post(`/graphql`)
      .send({ query: `{person(id:1){id}}` })
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.person.id, 1);
      });
  });

  it('delete a company by id', () => {
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

  it('delete a person by id', () => {
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

  it('create a company', () => {
    let postData = {
      query: `mutation createCompany($input:  CompanyCreateInputType){
                createCompany(input: $input){
                  name
                  employees_id
                  employees {
                    id
                  }
                }
            }`,
      variables: {
        input: {
          name: 'Company A',
          employees_id: [1]
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.createCompany.name, 'Company A');
        assert.deepEqual(res.body.data.createCompany.employees_id, [1]);
        assert.deepEqual(res.body.data.createCompany.employees, [{ id: 1 }]);
      });
  });

  it('create a person', () => {
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
        assert.equal(res.body.data.createPerson.firstname, 'FN');
        assert.equal(res.body.data.createPerson.lastname, 'LN');
        assert.equal(res.body.data.createPerson.age, 20);
        assert.equal(res.body.data.createPerson.salary, 20);
        assert.equal(
          res.body.data.createPerson.birthdate,
          moment(new Date('01/01/2017')).toISOString()
        );
      });
  });

  it('update a company', () => {
    let postData = {
      query: `mutation updateCompany($id: Int!,$input:  CompanyUpdateInputType){
                updateCompany(id: $id, input: $input){
                  id,
                  name
                  employees_id
                }
            }`,
      variables: {
        id: 1,
        input: {
          name: 'Company A',
          employees_id: [2]
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.updateCompany.id, 1);
        assert.equal(res.body.data.updateCompany.name, 'Company A');
        assert.deepEqual(res.body.data.updateCompany.employees_id, [2]);
      })
      .then(() => {
        return test
          .post(`/graphql`)
          .send({ query: `{company(id:1){id, name}}` })
          .expect(200)
          .then(res => {
            assert.equal(res.body.data.company.id, 1);
            assert.equal(res.body.data.company.name, 'Company A');
          });
      });
  });

  it('update a company with empty employees', () => {
    let postData = {
      query: `mutation updateCompany($id: Int!,$input:  CompanyUpdateInputType){
                updateCompany(id: $id, input: $input){
                  id,
                  name
                  employees_id
                }
            }`,
      variables: {
        id: 1,
        input: {
          name: 'test',
          employees_id: []
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.deepEqual(res.body.data.updateCompany.employees_id, []);
      });
  });

  it('update a person', () => {
    let postData = {
      query: `mutation updatePerson($id: Int!,$input:  PersonUpdateInputType){
                updatePerson(id:$id,input: $input){
                  id,
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                  company_id
                }
            }`,
      variables: {
        id: 1,
        input: {
          firstname: 'FN',
          lastname: 'LN',
          age: 20,
          salary: 20,
          birthdate: new Date('01/02/2017'),
          company_id: 2
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.updatePerson.id, 1);
        assert.equal(res.body.data.updatePerson.firstname, 'FN');
        assert.equal(res.body.data.updatePerson.lastname, 'LN');
        assert.equal(res.body.data.updatePerson.age, 20);
        assert.equal(res.body.data.updatePerson.salary, 20);
        assert.equal(
          res.body.data.updatePerson.birthdate,
          moment(new Date('01/02/2017')).toISOString()
        );
        assert.equal(res.body.data.updatePerson.company_id, 2);
      })
      .then(() => {
        return test
          .post(`/graphql`)
          .send({
            query: `{person(id:1){id, firstname, lastname, age, salary, birthdate}}`
          })
          .expect(200)
          .then(res => {
            assert.equal(res.body.data.person.id, 1);
            assert.equal(res.body.data.person.firstname, 'FN');
            assert.equal(res.body.data.person.lastname, 'LN');
            assert.equal(res.body.data.person.age, 20);
            assert.equal(res.body.data.person.salary, 20);
            assert.equal(
              res.body.data.person.birthdate,
              moment(new Date('01/02/2017')).toISOString()
            );
          });
      });
  });

  it('update a person', () => {
    let postData = {
      query: `mutation updatePerson($id: Int!,$input:  PersonUpdateInputType){
                updatePerson(id:$id,input: $input){
                  id,
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                  company_id
                }
            }`,
      variables: {
        id: 1,
        input: {
          company_id: null
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.updatePerson.company_id, null);
      });
  });

  it('create company and person in one mutation', () => {
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
          firstname: 'FN',
          lastname: 'LN',
          age: 20,
          salary: 20,
          birthdate: new Date('01/01/2017')
        },
        company: {
          name: 'Company A'
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.createPerson.firstname, 'FN');
        assert.equal(res.body.data.createPerson.lastname, 'LN');
        assert.equal(res.body.data.createPerson.age, 20);
        assert.equal(res.body.data.createPerson.salary, 20);
        assert.equal(
          res.body.data.createPerson.birthdate,
          moment(new Date('01/01/2017')).toISOString()
        );
        assert.equal(res.body.data.createCompany.name, 'Company A');
      });
  });

  it('update company and person in one mutation', () => {
    let postData = {
      query: `mutation ($personId:Int!,$person: PersonUpdateInputType, $companyId:Int!,$company: CompanyUpdateInputType){
                updatePerson(id:$personId,input: $person){
                  firstname,
                  lastname,
                  age,
                  salary,
                  birthdate
                }
                updateCompany(id:$companyId,input: $company){
                  id,
                  name
                }
            }`,
      variables: {
        personId: 1,
        person: {
          firstname: 'AA',
          lastname: 'BB',
          age: 20,
          salary: 20,
          birthdate: new Date('01/01/2017')
        },
        companyId: 1,
        company: {
          name: 'Company B'
        }
      }
    };

    return test
      .post(`/graphql?`)
      .send(postData)
      .expect(200)
      .then(res => {
        assert.equal(res.body.data.updatePerson.firstname, 'AA');
        assert.equal(res.body.data.updatePerson.lastname, 'BB');
        assert.equal(res.body.data.updatePerson.age, 20);
        assert.equal(res.body.data.updatePerson.salary, 20);
        assert.equal(
          res.body.data.updatePerson.birthdate,
          moment(new Date('01/01/2017')).toISOString()
        );
        assert.equal(res.body.data.updateCompany.name, 'Company B');
      });
  });
});
