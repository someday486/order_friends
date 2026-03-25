export class BranchListItemResponse {
  id: string;
  brandId: string;
  name: string;
  isActive: boolean;
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
  businessHours?: {
    monday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    tuesday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    wednesday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    thursday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    friday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    saturday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    sunday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
  } | null;
  orderNotice?: string | null;
  contactPhone?: string | null;
  depositSheetName?: string | null;
  depositSheetUrl?: string | null;
  kakaoChannelUrl?: string | null;
  createdAt: string;
}

export class BranchDetailResponse {
  id: string;
  brandId: string;
  name: string;
  isActive: boolean;
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
  businessHours?: {
    monday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    tuesday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    wednesday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    thursday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    friday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    saturday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    sunday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
  } | null;
  orderNotice?: string | null;
  contactPhone?: string | null;
  depositSheetName?: string | null;
  depositSheetUrl?: string | null;
  kakaoChannelUrl?: string | null;
  createdAt: string;
}
