import { createContext } from "react";
export const StorageStatus = createContext<{
  saved: boolean;
  owner: boolean;
  error: string;
}>({ saved: false, owner: false, error: "" });
