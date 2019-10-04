import { createContext } from "react";

export const AppContext = createContext({});
export const AppContextProvider = AppContext.Provider;
export const AppContextConsumer = AppContext.Consumer;

export default AppContext;
