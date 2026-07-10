import { z } from "zod";

/**
 * Employee Join Request — Sprint 001 spec:
 * "Employee Enters Business Email -> System Detects Domain ->
 *  Join Existing Agency -> Agency Admin Approval Required"
 */
export const createJoinRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Business email is required")
    .email("Enter a valid email address"),
  name: z.string().trim().min(2, "Full name is required").max(120),
});

export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>;

export const reviewJoinRequestSchema = z.object({
  joinRequestId: z.string().min(1),
  reason: z.string().max(500).optional(),
});
