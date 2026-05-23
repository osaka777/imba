import { AffiliateProgramApi } from "affiliate-program-api";
import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_HOST;
if (!baseURL) {
  throw new Error('NEXT_PUBLIC_HOST environment variable is required. Please set it in your .env.local file');
}

export const api = axios.create({
    baseURL,
});
