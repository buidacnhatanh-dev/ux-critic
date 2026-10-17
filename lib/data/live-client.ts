import { NotImplementedError, type DataClient } from "./client";

function notYet(method: string): Promise<never> {
  return Promise.reject(new NotImplementedError(`LiveClient.${method}`, "M5"));
}

/**
 * Live data source. Empty until M5: it will call the API routes from docs/01, which use SQLite
 * and the pipeline on the server. It never imports the database or the pipeline itself.
 */
export class LiveClient implements DataClient {
  readonly mode = "live" as const;

  listProjects = () => notYet("listProjects");
  getProject = () => notYet("getProject");
  getReview = () => notYet("getReview");
  startReview = () => notYet("startReview");
  retryEvaluation = () => notYet("retryEvaluation");
  setPushback = () => notYet("setPushback");
  deleteProject = () => notYet("deleteProject");
  getChecklist = () => notYet("getChecklist");
  saveChecklist = () => notYet("saveChecklist");
}
