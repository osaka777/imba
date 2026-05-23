export interface BetApiResponse<T = unknown> {
  body: T;
  page: string;
  status: number;
}