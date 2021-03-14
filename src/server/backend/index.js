import { BACKEND_API_ROOT } from "server/settings";
import GraphQLBackend from "./GraphQLBackend";
import RPCBackend from "./RPCBackend";

const backend =
  BACKEND_API_ROOT.indexOf("tcp://") === 0
    ? new RPCBackend({ url: BACKEND_API_ROOT })
    : new GraphQLBackend({ url: BACKEND_API_ROOT });

export default backend;
