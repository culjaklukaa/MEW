export type Role = "worker" | "sponsor";
export type Tab = "dashboard" | "plant" | "fund" | "satellite";

export interface LogEntry {
  time: string;
  msg: string;
}

export interface ParcelMetadata {
  name: string;
  location: string;
  area: number; // in m²
}

export interface Parcel {
  id: number;
  state: number; // 0=Planted, 1=Growing, 2=Verified
  escrowAmount: string;
  targetNDVI: number;
  currentNDVI: number;
  currentPhase: number; // 1: 30%, 2: 60%, 3: 100%
  owner: string;
  isReleased?: boolean;
  metadata?: ParcelMetadata;
}
