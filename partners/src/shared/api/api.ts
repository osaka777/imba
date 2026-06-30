import { AffiliateProgramApi } from "affiliate-program-api";
import axios from "axios";

import { getApiBaseUrl, getBrowserApiBaseUrl } from "../lib/apiBaseUrl";

export const api = axios.create({
  baseURL: typeof window !== "undefined" ? getBrowserApiBaseUrl() : getApiBaseUrl(),
});

export { AffiliateProgramApi, getApiBaseUrl };
