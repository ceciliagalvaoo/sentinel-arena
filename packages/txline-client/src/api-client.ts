import axios, { type AxiosInstance } from "axios";
import type { NetworkConfig } from "./config.js";

/** Authenticated REST client for TxLINE data endpoints (fixtures/odds/scores). */
export function createApiClient(config: NetworkConfig, jwt: string, apiToken: string): AxiosInstance {
  return axios.create({
    baseURL: config.apiBaseUrl,
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": apiToken,
    },
  });
}
