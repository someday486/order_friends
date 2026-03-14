export class BranchListItemResponse {
  id: string;
  brandId: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  thumbnailUrl?: string | null;
  enabledFulfillmentTypes?: string[];
  allowedPaymentMethods?: string[];
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
  pickupTimeConfig?: {
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  createdAt: string;
}

export class BranchDetailResponse {
  id: string;
  brandId: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  thumbnailUrl?: string | null;
  enabledFulfillmentTypes?: string[];
  allowedPaymentMethods?: string[];
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
  pickupTimeConfig?: {
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  createdAt: string;
}
