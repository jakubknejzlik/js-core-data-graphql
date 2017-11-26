const assert = require("assert");
const inflection = require("inflection");

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

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 10;

const schemaCache = {};

const getSchemaFromModel = model => {
  const queries = {};
  const mutations = {};

  const entityNames = Object.keys(model.entities);
  entityNames.forEach(entityName => {
    const entity = model.entities[entityName];
    const queryName = `get${inflection.pluralize(entity.name)}`;
    queries[queryName] = _getItemsQueryFromEntity(entity);

    const getEntity = `get${entity.name}`;
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

const _getItemsQueryFromEntity = entity => {
  return {
    type: _list(_getObjectTypeFromEntity(entity)),
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
      }
    },
    resolve: (obj, args, ctx) => {
      const offset = args.offset ? args.offset : DEFAULT_OFFSET;
      const limit = args.limit ? args.limit : DEFAULT_LIMIT;
      const sort = args.sort ? args.sort : "id";
      return ctx.context.getObjects(entity.name, { limit, offset, sort });
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

  return fields;
};

const attributeTypeMapping = {
  string: GraphQLString,
  text: GraphQLString,
  integer: GraphQLInt,
  double: GraphQLFloat,
  float: GraphQLFloat,
  decimal: GraphQLFloat,
  date: GraphQLString,
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

const _getRelationshipFromDescription = relationship => {
  const cacheKey = relationship.entity.name + "_rel_" + relationship.name;

  if (schemaCache[cacheKey]) {
    return schemaCache[cacheKey];
  }

  let rel = null;

  if (relationship.toMany) {
    rel = {
      type: _list(_getObjectTypeFromEntity(relationship.destinationEntity)),
      resolve: object => {
        const getter = `get${inflection.capitalize(relationship.name)}`;
        return object[getter]();
      }
    };
  } else {
    rel = {
      type: _getObjectTypeFromEntity(relationship.destinationEntity),
      resolve: object => {
        const getter = `get${inflection.capitalize(relationship.name)}`;
        return object[getter]();
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
      await ctx.context.save();
      return object;
    }
  };
};

const _updateEntity = entity => {
  const entityInputUpdateType = new GraphQLInputObjectType({
    name: `${entity.name}UpdateInputType`,
    fields: () => _getSchemaFieldsFromEntityWithoutRelationship(entity)
  });
  return {
    type: _getObjectTypeFromEntity(entity),
    description: `Create a ${entity.name}`,
    args: {
      input: {
        type: entityInputUpdateType
      }
    },
    resolve: async (obj, args, ctx) => {
      let object = await ctx.context.getObjectWithId(
        entity.name,
        args.input.id
      );
      object.setValues(args.input);
      await ctx.context.save();
      return object;
    }
  };
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
    enumObject[`${attribute.name.toUpperCase()}_DECS`] = {
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

module.exports = {
  getSchemaFromModel: getSchemaFromModel
};
