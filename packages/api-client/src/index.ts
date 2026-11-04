export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export class ApiClient {
  constructor(
    public baseUrl: string,
    private getToken: () => string | null = () => null,
  ) {}
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(30000),
    });
    if (response.status === 204) return undefined as T;
    const data = (await response.json()) as {
      error?: { message?: string; details?: unknown };
    };
    if (!response.ok)
      throw new ApiError(
        response.status,
        data.error?.message ?? `Request failed (${response.status})`,
        data.error?.details,
      );
    return data as T;
  }
  post<T>(path: string, data: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  patch<T>(path: string, data: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }
}
