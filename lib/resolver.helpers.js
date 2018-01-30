const allowedSearchColumnTypes = ["string", "text"];
const whereFromArgs = (entity, args) => {
  let where = undefined;

  if (args) {
    where = {};
    for (let attribute of entity.attributes) {
      where[attribute.name] = args[attribute.name];
    }
    for (let relationship of entity.relationships) {
      let val = args[`${relationship.name}_id`];
      if (typeof val !== "undefined") {
        where[`SELF.${relationship.name}.id`] = val;
      }
    }
  }

  let q = args && args.q;
  if (q) {
    let query = q.split(" ");

    let fields = entity.attributes.map(r => r.name);
    console.log(fields);

    let queryWhere = { $and: [] };
    let attributes = entity.attributesByName();
    query.forEach(searchWord => {
      searchWord = searchWord.toLowerCase();
      let fieldsWhere = [];
      fields.forEach(field => {
        if (
          attributes[field] &&
          allowedSearchColumnTypes.indexOf(attributes[field].type) !== -1
        ) {
          let searchValuePrefix = {};
          searchValuePrefix[`LOWER(${field})?`] = `${searchWord}*`;
          let searchValueMiddle = {};
          searchValueMiddle[`LOWER(${field})?`] = `* ${searchWord}*`;
          fieldsWhere.push(searchValuePrefix, searchValueMiddle);
        }
      });
      queryWhere.$and.push({ $or: fieldsWhere });
    });

    where = { $and: where ? [where, queryWhere] : [queryWhere] };
  }
  return where;
};

module.exports = {
  whereFromArgs
};
