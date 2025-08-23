// In Memory Mapping  ( swap to DB later )
// Later switch to Postgres: create migration and a FilePlan table and update this class to use DB.

import { FilePlan } from "../models/types";

export function createMappingStore() {
  const files: Map<string, FilePlan> = new Map();

  const saveFilePlan = (plan: FilePlan) => {
    files.set(plan.filename, plan);
  };

  const getFilePlan = (filename: string): FilePlan | undefined => {
    return files.get(filename);
  };

  const listFiles = (): FilePlan[] => {
    return Array.from(files.values());
  };

  // placeholder for persistence logic in future
  // e.g., save to DB or reload from DB

  return {
    saveFilePlan,
    getFilePlan,
    listFiles,
  };
}

export const mappingStore = createMappingStore();
