const assert = require("assert");
const inflection = require("inflection");
const moment = require("moment");

const helpers = require("./resolver.helpers");

const graphql = require("graphql");

const GraphQLList = graphql.GraphQLList;
const GraphQLNonNull = graphql.GraphQLNonNull;
const GraphQLObjectType = graphql.GraphQLObjectType;
const GraphQLSchema = graphql.GraphQLSchema;

const GraphQLString = graphql.GraphQLString;
const GraphQLInt = graphql.GraphQLInt;
const GraphQLFloat = graphql.GraphQLFloat;
const GraphQLID = graphql.GraphQLID;
const GraphQLBoolean = graphql.GraphQLBoolean;
const GraphQLInputObjectType = graphql.GraphQLInputObjectType;
const GraphQLEnumType = graphql.GraphQLEnumType;
const GraphQLScalarType = graphql.GraphQLScalarType;

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 10;

const schemaCache = {};

const GraphqlDate = new GraphQLScalarType({
  name: "Date",
  description: "Date in ISO 8601 format",
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    return ast.value;
  }
});

const getSchemaFromModel = model => {
  const queries = {};
  const mutations = {};

  const entityNames = Object.keys(model.entities);
  entityNames.forEach(entityName => {
    const entity = model.entities[entityName];
    const queryName = inflection.camelize(
      inflection.pluralize(entity.name),
      true
    );
    queries[queryName] = _getItemsQueryFromEntity(entity);

    const getEntity = inflection.camelize(entity.name, true);
    queries[getEntity] = _getItemQueryByIdFromEntity(entity);

    const createEntity = `create${entity.name}`;
    mutations[createEntity] = _createEntity(entity);

    const updateEntity = `update${entity.name}`;
    mutations[updateEntity] = _updateEntity(entity);

    const deleteEnity = `delete${entity.name}`;
    mutations[deleteEnity] = _deleteEntityById(entity);
  });

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: queries
    }),
    mutation: new GraphQLObjectType({
      name: "Mutation",
      fields: mutations
    })
  });
};

const _nonnull = value => {
  return new GraphQLNonNull(value);
};
const _list = value => {
  return _nonnull(new GraphQLList(_nonnull(value)));
};
const _optionalList = value => {
  return new GraphQLList(_nonnull(value));
};

const _getItemsQueryFromEntity = entity => {
  let entityResult = new GraphQLObjectType({
    name: `${entity.name}Result`,
    fields: {
      items: { type: _list(_getObjectTypeFromEntity(entity)) },
      count: { type: _nonnull(GraphQLInt) }
    }
  });

  return {
    type: _nonnull(entityResult),
    args: {
      offset: {
        type: GraphQLInt,
        description: `Default is 0`
      },
      limit: {
        type: GraphQLInt,
        description: `Default is 10`
      },
      sort: {
        type: _makeSortObjectType(entity)
      },
      filter: {
        type: _makeFilterObjectType(entity)
      }
    },
    resolve: (obj, args, ctx) => {
      const offset = args.offset ? args.offset : DEFAULT_OFFSET;
      const limit = args.limit ? args.limit : DEFAULT_LIMIT;
      const sort = args.sort ? args.sort : "id";
      const where = helpers.whereFromArgs(entity, args.filter);
      return {
        items: () => {
          return ctx.context.getObjects(entity.name, {
            limit,
            offset,
            sort,
            where
          });
        },
        count: () => {
          return ctx.context.getObjectsCount(entity.name, { where });
        }
      };
    }
  };
};

const _getItemQueryByIdFromEntity = entity => {
  return {
    type: _getObjectTypeFromEntity(entity),
    description: `Fetch ${entity.name} by id`,
    args: {
      id: {
        type: GraphQLInt,
        description: `Id of fetched entity ${entity.name}`
      }
    },
    resolve: (obj, args, ctx) => {
      return ctx.context
        .getObjectWithId(entity.name, args.id)
        .then(data => data);
    }
  };
};

let objectTypes = {};
const _getObjectTypeFromEntity = entity => {
  if (!objectTypes[entity.name]) {
    objectTypes[entity.name] = new GraphQLObjectType({
      name: entity.name,
      fields: () => {
        return _getSchemaFieldsFromEntity(entity);
      }
    });
  }
  return objectTypes[entity.name];
};

const _getSchemaFieldsFromEntity = entity => {
  let fields = {
    id: { type: _nonnull(GraphQLInt) }
  };

  Object.keys(entity.attributes).forEach(attributeName => {
    const attribute = entity.attributes[attributeName];
    fields[attribute.name] = _getAttributeFromDescription(attribute);
  });

  Object.keys(entity.relationships).forEach(relationshipName => {
    const relationship = entity.relationships[relationshipName];
    fields[relationship.name] = _getRelationshipFromDescription(relationship);
    fields[`${relationship.name}_id`] = _getRelationshipFromDescription(
      relationship,
      true
    );
  });

  return fields;
};

const _getSchemaFieldsFromEntityWithoutRelationship = (
  entity,
  showId = true
) => {
  let fields = {};
  if (showId) {
    fields.id = {
      type: _nonnull(GraphQLInt)
    };
  }

  Object.keys(entity.attributes).forEach(attributeName => {
    const attribute = entity.attributes[attributeName];
    fields[attribute.name] = _getAttributeFromDescription(attribute);
  });

  Object.keys(entity.relationships).forEach(relationshipName => {
    const relationship = entity.relationships[relationshipName];
    if (relationship.toMany) {
      fields[`${relationship.name}_id`] = { type: _optionalList(GraphQLInt) };
    } else {
      fields[`${relationship.name}_id`] = { type: GraphQLInt };
    }
  });

  return fields;
};

const attributeTypeMapping = {
  string: GraphQLString,
  text: GraphQLString,
  integer: GraphQLInt,
  double: GraphQLFloat,
  float: GraphQLFloat,
  decimal: GraphQLFloat,
  date: GraphqlDate,
  uuid: GraphQLID,
  boolean: GraphQLBoolean,
  enum: attr => {
    let values = {};

    for (let value of attr.info.values) {
      values[value.toUpperCase()] = {
        value: value,
        description: `Enum value of attribute ${attr.name}`
      };
    }

    return new GraphQLEnumType({ name: attr.name, values: values });
  }
};
const _getAttributeFromDescription = attribute => {
  const cacheKey = attribute.entity.name + "_attr_" + attribute.name;

  if (schemaCache[cacheKey]) {
    return schemaCache[cacheKey];
  }

  let attrType =
    attributeTypeMapping[attribute.type] ||
    attributeTypeMapping[attribute.persistentType];
  if (typeof attrType === "function") {
    attrType = attrType(attribute);
  }
  assert.ok(attrType, `unknown mapping for attribute type ${attribute.type}`);
  attrType = attribute.info.required ? _nonnull(attrType) : attrType;
  schemaCache[cacheKey] = { type: attrType };
  return schemaCache[cacheKey];
};

const _getRelationshipFromDescription = (relationship, idOnly = false) => {
  const cacheKey =
    relationship.entity.name +
    "_rel_" +
    relationship.name +
    "_id:" +
    (idOnly ? "true" : "false");

  if (schemaCache[cacheKey]) {
    return schemaCache[cacheKey];
  }

  let rel = null;

  if (relationship.toMany) {
    rel = {
      type: _list(
        idOnly
          ? GraphQLInt
          : _getObjectTypeFromEntity(relationship.destinationEntity)
      ),
      resolve: object => {
        const getter = `get${inflection.camelize(relationship.name)}`;
        if (idOnly) {
          return object[getter]().map(x => x.id);
        } else {
          return object[getter]();
        }
      }
    };
  } else {
    rel = {
      type: idOnly
        ? GraphQLInt
        : _getObjectTypeFromEntity(relationship.destinationEntity),
      resolve: object => {
        const getter = `get${inflection.camelize(relationship.name)}`;
        if (idOnly) {
          return object[getter]().then(x => (x ? x.id : null));
        } else {
          return object[getter]();
        }
      }
    };
  }
  schemaCache[cacheKey] = rel;
  return rel;
};

const _createEntity = entity => {
  const entityInputType = new GraphQLInputObjectType({
    name: `${entity.name}CreateInputType`,
    fields: () => _getSchemaFieldsFromEntityWithoutRelationship(entity, false)
  });
  return {
    type: _getObjectTypeFromEntity(entity),
    description: `Create a ${entity.name}`,
    args: {
      input: {
        type: entityInputType
      }
    },
    resolve: async (obj, args, ctx) => {
      const object = ctx.context.create(entity.name, args.input);

      for (let relationship of entity.relationships) {
        if (args.input[`${relationship.name}_id`]) {
          await _updateObjectRelationship(
            object,
            relationship,
            args.input[`${relationship.name}_id`]
          );
        }
      }

      await ctx.context.save();
      return object;
    }
  };
};

const _updateEntity = entity => {
  const entityInputUpdateType = new GraphQLInputObjectType({
    name: `${entity.name}UpdateInputType`,
    fields: () => _getSchemaFieldsFromEntityWithoutRelationship(entity, false)
  });
  return {
    type: _getObjectTypeFromEntity(entity),
    description: `Create a ${entity.name}`,
    args: {
      id: { type: _nonnull(GraphQLInt) },
      input: {
        type: entityInputUpdateType
      }
    },
    resolve: async (obj, args, ctx) => {
      let object = await ctx.context.getObjectWithId(entity.name, args.id);
      object.setValues(args.input);

      for (let relationship of entity.relationships) {
        if (args.input[`${relationship.name}_id`]) {
          await _updateObjectRelationship(
            object,
            relationship,
            args.input[`${relationship.name}_id`]
          );
        }
      }

      await ctx.context.save();
      return object;
    }
  };
};

const _updateObjectRelationship = async (entity, relationship, value) => {
  let name = inflection.camelize(relationship.name);
  if (relationship.toMany) {
    let getter = `get${name}`;
    let adder = `add${name}`;
    let remover = `remove${name}`;
    let values = await entity[getter]();
    await entity[remover](values);
    if (value.length > 0) {
      let newValues = await entity.managedObjectContext.getObjects(
        relationship.destinationEntity.name,
        { where: { id: value } }
      );
      await entity[adder](newValues);
    }
  } else {
    let setter = `set${name}`;
    let newValue =
      value === null
        ? null
        : await entity.managedObjectContext.getObjectWithId(
            relationship.destinationEntity.name,
            value
          );
    await entity[setter](newValue);
  }
};

const _deleteEntityById = entity => {
  return {
    type: _getObjectTypeFromEntity(entity),
    description: `Delete a ${entity.name} by Id`,
    args: {
      id: {
        type: GraphQLInt
      }
    },
    resolve: async (obj, args, ctx) => {
      const object = await ctx.context.getObjectWithId(entity.name, args.id);
      ctx.context.deleteObject(object);
      await ctx.context.save();
      return object;
    }
  };
};

const _makeSortObjectType = entity => {
  let enumObject = {
    ID: {
      value: "id",
      description: `Sort by id - Ascending`
    },
    ID_DESC: {
      value: "-id",
      description: `Sort by id - Descending`
    }
  };
  Object.keys(entity.attributes).forEach(attributeName => {
    const attribute = entity.attributes[attributeName];
    enumObject[`${attribute.name.toUpperCase()}`] = {
      value: attribute.name,
      description: `Sort by ${attributeName} - Ascending`
    };
    enumObject[`${attribute.name.toUpperCase()}_DESC`] = {
      value: `-${attribute.name}`,
      description: `Sort by ${attribute.name} - Descending`
    };
  });
  const sortType = new GraphQLEnumType({
    name: `${entity.name}SortType`,
    values: enumObject
  });

  return new GraphQLList(_nonnull(sortType));
};

const _makeFilterObjectType = entity => {
  let fields = {
    q: { type: GraphQLString }
  };

  for (let attribute of entity.attributes) {
    fields[attribute.name] = {
      type: GraphQLString
    };
  }
  for (let relationship of entity.relationships) {
    fields[`${relationship.name}_id`] = {
      type: relationship.toMany ? _optionalList(GraphQLInt) : GraphQLInt
    };
  }

  let type = new GraphQLInputObjectType({
    name: `${entity.name}FilterType`,
    fields
  });
  return type;
};

module.exports = {
  getSchemaFromModel: getSchemaFromModel
};
