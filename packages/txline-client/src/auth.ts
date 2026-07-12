import axios from "axios";

interface GuestAuthResponse {
  token: string;
}

/** POST /auth/guest/start — permissionless, no credentials required. JWT expires in 30 days. */
export async function startGuestAuth(apiOrigin: string): Promise<string> {
  const response = await axios.post<GuestAuthResponse>(`${apiOrigin}/auth/guest/start`);
  return response.data.token;
}
