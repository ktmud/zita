import { ApolloServer } from "apollo-server-micro";
import typeDefs from "server/graphql/typedef";
import resolvers from "server/graphql/resolver";
import { ZT_UID } from "lib/client";

const context = async ({ req }) => {
  const ztuid =
    req.headers[`X-${ZT_UID}`.toLowerCase()] || req.cookies[ZT_UID] || null;
  // const model =
  //   req.headers[`X-${ZT_MODEL}`.toLowerCase()] || req.cookies[ZT_MODEL] || null;
  return { ztuid };
};

// Export Apollo Server to Next.js
const apolloServer = new ApolloServer({ typeDefs, resolvers, context });
export const config = {
  api: {
    bodyParser: false
  }
};
export default apolloServer.createHandler({ path: "/api/graphql" });
