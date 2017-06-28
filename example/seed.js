module.exports = database => {
  return database.syncSchema({ force: true }).then(() => {
    const context = database.createContext();
    let company1 = context.create("Company", { name: "test" });
    let company2 = context.create("Company", { name: "test2" });
    let company3 = context.create("Company", { name: "test3" });

    let person1 = context.create("Person", {
      firstname: "john",
      lastname: "Doe"
    });
    let person2 = context.create("Person", {
      firstname: "Jane",
      lastname: "Siri"
    });
    let person3 = context.create("Person", {
      firstname: "Steveo",
      lastname: "Drops"
    });

    company1.addEmployees([person1, person2]);
    company2.addEmployees([person3]);
    company3.addEmployees([person1, person2, person3]);

    return context.save().finally(() => {
      context.destroy();
    });
  });
};
