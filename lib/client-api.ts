"use client";

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export async function readApiResponse<T>(response: Response): Promise<ApiPayload<T>> {
  const text = await response.text();

  if (!text) {
    return {
      success: response.ok,
      message: response.ok
        ? undefined
        : `Request failed with ${response.status} ${response.statusText}`,
    };
  }

  try {
    return JSON.parse(text) as ApiPayload<T>;
  } catch {
    return {
      success: false,
      message: text.slice(0, 300) || `Request failed with ${response.status}`,
    };
  }
}
