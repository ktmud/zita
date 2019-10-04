/**
 * Backend Modeler and Predictor
 */
import gql from "graphql-tag";
import { fetchgql } from "lib/client";
import Debug from "debug";

const ptDebug = Debug("ZT.backend");

export default class GraphQLBackend {
  type = "GraphQL";

  constructor({ url, model }) {
    // API endpoint
    this.url = url;
    this.model = model;
  }

  setModel(model) {
    this.model = model;
  }

  query(query, variables, ctx) {
    return fetchgql(query, variables, { ctx, apiRoot: this.url });
  }

  /**
   * Predict photo tags for one photo
   */
  predict(photoId) {
    return this.query(`{
      prediction(photoId: "${photoId}") {
        tags
      }
    }`).tags;
  }

  async predictBatch(photoIds) {
    if (!photoIds || photoIds.length === 0) {
      return [];
    }
    ptDebug("Predict %s photos", photoIds.length);
    const data = await this.query(
      gql`
        query PredictBatch($photoIds: [String!]!) {
          predictions(photoIds: $photoIds) {
            tags
          }
        }
      `,
      { photoIds }
    );
    ptDebug("Fetched predictions for %s photos", photoIds.length);
    // console.log(data)
    return data.predictions.map(x => x.tags);
  }
}
