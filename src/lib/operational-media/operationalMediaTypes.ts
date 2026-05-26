/** Phase 3F — operational photo metadata (reference only, no upload infra). */

export interface OperationalPhotoMetadata {
  imageReference: string;
  caption: string | null;
  queueItemId: string;
  scanCorrelationId: string | null;
  department: string;
  actorUserId: string;
  capturedAt: string;
  verificationRelation: "queue_note" | "scan_evidence" | "handoff_proof";
}

export interface OperationalPhotoInput {
  imageReference: string;
  caption?: string | null;
  queueItemId: string;
  department: string;
  actorUserId: string;
  scanCorrelationId?: string | null;
  verificationRelation?: OperationalPhotoMetadata["verificationRelation"];
}
