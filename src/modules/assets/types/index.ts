// Asset module types.
// AssetClass is re-exported from platform so all modules share one source of truth.
export { AssetClass } from "@/modules/platform/types";

export enum AssetStatus {
  ACTIVE      = "ACTIVE",
  INACTIVE    = "INACTIVE",
  MAINTENANCE = "MAINTENANCE",
}

// Matches the Prisma Asset model / public.Asset table.
export interface Asset {
  id:           string;
  asset_class:  import("@/modules/platform/types").AssetClass;
  owner_id:     string;
  display_name: string;
  meta_json:    Record<string, unknown>;
  status:       AssetStatus;
  created_at:   string;
  updated_at:   string;
}

// VehicleAssetMeta is what goes in Asset.meta_json when asset_class = CAB.
export interface VehicleAssetMeta {
  vehicle_id: string;
  number:     string;
}
