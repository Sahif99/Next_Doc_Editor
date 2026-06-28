import { NextRequest } from "next/server";
import { RegisterSchema } from "@/validators/auth";
import { error, success } from "@/lib/apiResponse";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { hashPassword } from "@/lib/hash";
import { randomAvatar } from "@/utils/randomAvatar";
import { enforceRateLimit, readLimitedJson } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, "auth:register", {
      windowMs: 10 * 60 * 1000,
      max: 8,
    });

    if (limited) return limited;

    const body = await readLimitedJson(request, 8_000);
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return error(parsed.error.issues[0]?.message ?? "Invalid input", 422);
    }

    await connectDB();

    const existingUser = await User.findOne({ email: parsed.data.email });

    if (existingUser) {
      return error("An account with this email already exists", 409);
    }

    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      password: await hashPassword(parsed.data.password),
      avatar: randomAvatar(parsed.data.name),
    });

    return success(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
      201
    );
  } catch (err) {
    if (err instanceof Error && err.message === "REQUEST_TOO_LARGE") {
      return error("Request body is too large", 413);
    }

    if (err instanceof Error && err.message === "INVALID_JSON") {
      return error("Invalid JSON body", 400);
    }

    console.error(err);
    return error("Unable to create account", 500);
  }
}
