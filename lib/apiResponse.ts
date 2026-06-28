import { NextResponse } from "next/server";

export function success(
  data: unknown,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
    }
  );
}

export function error(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

export function failure(
  data: Record<string, unknown>,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      ...data,
    },
    {
      status,
    }
  );
}
