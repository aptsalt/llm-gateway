const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error((error as { error?: { message?: string } }).error?.message ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export async function fetchAdminApi<T>(path: string, adminKey: string, options?: RequestInit): Promise<T> {
  return fetchApi<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      ...options?.headers,
    },
  });
}
