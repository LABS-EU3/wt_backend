const { gql } = require('apollo-server-express');
const authSchema = require('./auth.graphql');
const unitSchema = require('./unit.graphql');
const exerciseSchema = require('./exercise.graphql');
const workoutSchema = require('./workout.graphql');

const rootSchema = gql`
  type Query {
    _: Boolean
  }
  type Mutation {
    _: Boolean
  }

  input Filter {
    search: String!
    field: [String!]!
  }

  ${authSchema}
  ${unitSchema}
  ${exerciseSchema}
  ${workoutSchema}
`;

module.exports = rootSchema;
