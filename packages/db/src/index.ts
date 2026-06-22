export { connectDb, disconnectDb } from "./connect.js";
export { checkRateLimit, type RateLimitResult } from "./rateLimit.js";
export { ensureTimeSeriesCollection } from "./ensureCollections.js";

// Models
export { IntentStrandModel } from "./models/intentStrand.js";
export { VulnerabilityModel } from "./models/vulnerability.js";
export { AntibodyModel } from "./models/antibody.js";
export { EntropyTimeseriesModel } from "./models/entropyTimeseries.js";
export { IncidentModel } from "./models/incident.js";
export { ShadowProofModel } from "./models/shadowProof.js";
export { HomeostasisModel } from "./models/homeostasis.js";

// Repos
export type { HelixDoc } from "./repos/intentStrand.js";
export {
  createIntentStrand,
  findIntentStrandById,
  updateIntentStrand,
  listIntentStrands,
} from "./repos/intentStrand.js";

export {
  createVulnerability,
  findVulnerabilityById,
  updateVulnerability,
  listVulnerabilities,
} from "./repos/vulnerability.js";

export {
  createAntibody,
  findAntibodyById,
  findAntibodyByAntibodyId,
  updateAntibody,
  listAntibodies,
} from "./repos/antibody.js";

export {
  createEntropyPoint,
  findEntropyPointById,
  updateEntropyPoint,
  listEntropyPoints,
} from "./repos/entropyTimeseries.js";

export {
  createIncident,
  findIncidentById,
  findIncidentByIncidentId,
  updateIncident,
  listIncidents,
} from "./repos/incident.js";

export {
  createShadowProof,
  findShadowProofById,
  findShadowProofByProofId,
  updateShadowProof,
  listShadowProofs,
} from "./repos/shadowProof.js";

export {
  createHomeostasis,
  findHomeostasisById,
  updateHomeostasis,
  listHomeostasis,
} from "./repos/homeostasis.js";

export { GitHubConnectionModel } from "./models/githubConnection.js";
export { DriftReportModel } from "./models/driftReport.js";

export {
  upsertGitHubConnection,
  findGitHubConnection,
  listGitHubConnections,
  deleteGitHubConnection,
} from "./repos/githubConnection.js";

export {
  createDriftReport,
  findDriftReportByDriftId,
  updateDriftReport,
  listDriftReports,
} from "./repos/driftReport.js";

export { IncidentPatchModel } from "./models/incidentPatch.js";
export {
  createIncidentPatch,
  findIncidentPatchByPatchId,
  updateIncidentPatch,
  listIncidentPatches,
} from "./repos/incidentPatch.js";

export { ImmuneScanRunModel } from "./models/immuneScanRun.js";
export {
  createImmuneScanRun,
  findImmuneScanRunByScanId,
  updateImmuneScanRun,
  listImmuneScanRuns,
} from "./repos/immuneScanRun.js";

export { MetabolismRunModel } from "./models/metabolismRun.js";
export {
  createMetabolismRun,
  findMetabolismRunByRunId,
  updateMetabolismRun,
  listMetabolismRuns,
} from "./repos/metabolismRun.js";
