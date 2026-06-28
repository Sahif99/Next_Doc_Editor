import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80).trim(),
  email: z.string().email("Enter a valid email").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

export const LoginSchema = z.object({
  email: z.string().email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});
