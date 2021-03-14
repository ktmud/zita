import { gql } from "apollo-server-micro";

export default gql`
  type Query {
    # get the list of albums
    albums(limit: Int = -1, offset: Int = 0): [Album!]!

    # get photos of one album
    album(
      id: String!
      limit: Int = 10
      offset: Int = 0
      # load all tagged photos, even if it exceeds limit
      loadAllTagged: Boolean = true
    ): Album

    # get predTags by photoId
    preds(photoIds: [String!]!, model: String): [Prediction!]!
    pred(photoId: String!, model: String): Prediction!

    # all possible tags
    tagOptions: [String!]!

    # all possible models
    modelOptions: [String!]!

    # current running model
    defaultModel: String

    # get all tagged photos
    taggedPhotos(albumId: String): [PhotoTagExport!]!

    nextAvailAlbum(checkTaggers: Boolean = true): Album
  }
  type Mutation {
    tagPhoto(id: String!, tags: [String]!): PhotoMutated
    tagPhotos(tags: [PhotoMutation!]!): [PhotoMutated!]!
  }
  type Album {
    id: String!
    idx: Int
    title: String!
    atimeMs: Float
    mtimeMs: Float
    ctimeMs: Float
    size: Int!
    # number of users tagging this photo (excluding current user)
    taggers: Int
    totalPhotos: Int!
    taggedPhotos: Int!
    photos(limit: Int = 10, offset: Int = 0): [Photo!]!
  }
  type Photo {
    id: String!
    idx: Int
    atimeMs: Float
    mtimeMs: Float
    ctimeMs: Float
    size: Int!
    # true tags
    tags: [String!]!
    # predicted tags can be NULL, which indicates the backend
    # hasn't finished computing the predictions yet
    predTags(model: String): [String!]
  }
  type PhotoTagExport {
    id: String!
    tags: [String!]!
  }
  input PhotoMutation {
    id: String!
    tags: [String!]!
  }
  type PhotoMutated {
    id: String!
    tags: [String!]!
    taggers: Int # number of taggers for the album
    prevTags: [String!]
    incr: Int! # +1 or -1 on album's taggedPhotos count
  }
  type Prediction {
    id: String!
    model: String!
    classes: [String!]
    tags: [String!]
    preds: [Float!]
    probs: [Float!]
  }
`;
