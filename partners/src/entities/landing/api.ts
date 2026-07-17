import { cookies } from "next/headers";
import axios from "axios";
import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";
import type { CreateLandingPayload, PartnerLandingItem } from "./types";

async function authHeaders() {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) throw new Error("Unauthorized");
  return { Authorization: `Bearer ${token}` };
}

export async function getPartnerLandings(): Promise<PartnerLandingItem[]> {
  const { data } = await axios.get<PartnerLandingItem[]>(
    `${getApiBaseUrl()}/affiliate-program/user/landings`,
    { headers: await authHeaders() },
  );
  return data;
}

export async function createPartnerLanding(
  payload: CreateLandingPayload,
): Promise<PartnerLandingItem> {
  const { data } = await axios.post<PartnerLandingItem>(
    `${getApiBaseUrl()}/affiliate-program/user/landings`,
    payload,
    { headers: await authHeaders() },
  );
  return data;
}

export async function deletePartnerLanding(id: string) {
  await axios.delete(`${getApiBaseUrl()}/affiliate-program/user/landings/${id}`, {
    headers: await authHeaders(),
  });
}
