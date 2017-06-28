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
const GraphQLBoolean = graphql.GraphQLBoolean;
const GraphQLID = graphql.GraphQLID;

const getSchemaFromModel = model => {
  const queries = {};

  const entityNames = Object.keys(model.entities);
  entityNames.forEach(entityName => {
    const entity = model.entities[entityName];
    const queryName = `get${inflection.pluralize(entity.name)}`;
    queries[queryName] = _getItemsQueryFromEntity(entity);
  });

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: queries
    }),
    mutation: new GraphQLObjectType({
      name: "Mutation",
      fields: queries
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
    resolve: (obj, args, ctx) => {
      return ctx.context.getObjects(entity.name);
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

const attributeTypeMapping = {
  string: GraphQLString,
  int: GraphQLInt,
  float: GraphQLFloat,
  decimal: GraphQLFloat,
  date: GraphQLString,
  uuid: GraphQLID
};
const _getAttributeFromDescription = attribute => {
  let type = attributeTypeMapping[attribute.type];
  assert.ok(type, `unknown mapping for attribute type ${attribute.type}`);
  type = attribute.info.required ? _nonnull(type) : type;
  return { type: type };
};

const _getRelationshipFromDescription = relationship => {
  if (relationship.toMany) {
    return {
      type: _list(_getObjectTypeFromEntity(relationship.destinationEntity)),
      resolve: object => {
        const getter = `get${inflection.capitalize(relationship.name)}`;
        return object[getter]();
      }
    };
  } else {
    return {
      type: _getObjectTypeFromEntity(relationship.destinationEntity),
      resolve: object => {
        const getter = `get${inflection.capitalize(relationship.name)}`;
        return object[getter]();
      }
    };
  }
};

module.exports = {
  getSchemaFromModel: getSchemaFromModel
};
