export interface BetPlaceResponse {
  status?: number;
  errorCode?: number;
  fullErrorCode?: string;
  betCode?: string;
  d?: {
    BetHeadDetail?: {
      BetCode?: string;
      Status?: number;
      Coef?: number;
      CoefOrig?: number;
      IsLive?: boolean;
      ErrorCode?: number;
      FullErrorCode?: string;
    };
  };
  message?: string;
  error?: string;
}