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

  const removeFilePlan = (filename: string) => {
    return files.delete(filename);
  };

  const removeWorker = (workerId: string) =>{
  for (const file of files.values()) {
    for (const chunk of file.chunks) {
      if (chunk.workers) {
        // overwrite chunk.workers with a new array
        // containing everything except the given workerId
        chunk.workers = chunk.workers.filter((w) => w !== workerId);
      }
    }
  }
}


  // placeholder for persistence logic in future
  // e.g., save to DB or reload from DB

  return {
    saveFilePlan,
    getFilePlan,
    listFiles,
    removeFilePlan,
    removeWorker,
  };
}

export const mappingStore = createMappingStore();
