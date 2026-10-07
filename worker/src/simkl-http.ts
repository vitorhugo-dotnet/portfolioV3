const APP_NAME = "portfolio-v3";
const APP_VERSION = "3.0.0";

export function simklApiRequest(
  url: URL,
  clientId: string,
  accessToken: string,
): { url: URL; headers: HeadersInit } {
  url.searchParams.set("app-name", APP_NAME);
  url.searchParams.set("app-version", APP_VERSION);
  return {
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "simkl-api-key": clientId,
      "User-Agent": `${APP_NAME}/${APP_VERSION}`,
    },
  };
}
