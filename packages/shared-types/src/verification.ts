/** Result shape for the public commit-reveal verification tool (architecture doc section 4.3). */
export interface VerificationChecks {
  signalIdsMatch: boolean;
  referencesCorrectCommit: boolean;
  hashesMatch: boolean;
  commitBeforeReveal: boolean;
}

export interface VerificationResult {
  valid: boolean;
  checks: VerificationChecks;
  commitSlot: number | null;
  revealSlot: number | null;
}
