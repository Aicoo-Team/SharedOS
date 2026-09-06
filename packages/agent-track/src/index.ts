// Core
export { TrackRecordCollector } from "./collector.js";
export {
  createTrackRecordStore,
  addEvent,
  addTurnRecord,
  serializeStore,
  deserializeStore,
} from "./collector.js";
export type { TrackRecordStore, SerializedTrackRecordStore, TurnRecord } from "./collector.js";

// Analyzer
export { analyzeTrackRecord } from "./analyzer.js";
export type {
  AgentTrackRecord,
  TrackRecordSummary,
  GateDenialBreakdown,
  PrecedentEntry,
  TurnSummary,
} from "./analyzer.js";

// MCP tool
export { AGENT_TRACK_RECORD_DEFINITION, agentTrackRecordTool } from "./tool.js";

// Time-window aggregation
export { computeWindowedTrackRecord, ROLLING_WINDOWS } from "./windows.js";
export type { TimeWindow, WindowedRecord, WindowedTrackRecord } from "./windows.js";

// Multi-agent comparison
export { compareTrackRecords } from "./compare.js";
export type { AgentDiff, MultiAgentComparison } from "./compare.js";

// Threshold alerts
export { checkAlerts, criticalAlerts, warningAlerts } from "./alerts.js";
export type { TrackRecordAlert, AlertThresholds } from "./alerts.js";

// Tool-level breakdown
export { computeToolBreakdown } from "./tools.js";
export type { ToolStats, ToolBreakdown } from "./tools.js";

// Persistent storage adapter
export { InMemoryTrackRecordAdapter, loadStoreFromAdapter } from "./adapter.js";
export type { TrackRecordStoreAdapter } from "./adapter.js";

// Streaming analysis
export { StreamingAgentTracker, StreamingTracker } from "./streaming.js";
export type { StreamingSnapshot } from "./streaming.js";

// Export formats
export {
  exportCSV,
  exportCSVComparison,
  exportPrometheus,
  exportPrometheusMulti,
} from "./export.js";

// Precedent integration
export { TrackRecordPrecedentLookup, enrichWithContext } from "./precedent.js";
export type { TrackRecordPrecedent, TrackRecordContext } from "./precedent.js";

// Anomaly detection
export { detectAnomalies } from "./anomaly.js";
export type { Anomaly, AnomalyConfig } from "./anomaly.js";

// Reputation protocol
export { createSignedSnapshot, verifySignedSnapshot, importSignedSnapshot } from "./reputation.js";
export type { SignedTrackRecordSnapshot } from "./reputation.js";
