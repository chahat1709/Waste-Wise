export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Relative URLs keep browser calls inside the deployed origin. The web client must
 * never target localhost or receive service-role/provider credentials.
 */
export async function apiFetch<TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    credentials: "same-origin",
  });

  const responseBody = await response.json().catch(() => null) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      responseBody?.error?.message ?? "The request could not be completed.",
      response.status,
      responseBody?.error?.code,
    );
  }

  return responseBody as TResponse;
}
