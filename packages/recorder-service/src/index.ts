export * from "./backfill.js";

// Live SSE recording (architecture doc section 8.1, RecorderService) is a
// secondary path now that backfillFixture proves historical REST backfill
// works — still useful once the agent is running live, but no longer the
// only way to populate `recorded_events`.
