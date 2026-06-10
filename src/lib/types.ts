import { z } from 'zod';
import { LENS_IDS } from './lenses';

export const LensIdSchema = z.enum(LENS_IDS);

export const BoardMemberPayload = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  label: z.string().min(1),
  lens: LensIdSchema.optional(),
});

export const ReviewPayload = z.object({
  rankings: z
    .array(
      z.object({
        key: z.string().length(1),
        rank: z.number().int().min(1),
      }),
    )
    .min(1),
  strongest: z.string().length(1),
  strongestReason: z.string().min(1),
  weakest: z.string().length(1),
  weakestReason: z.string().min(1),
  whatAllMissed: z.string().min(1),
});

export type ReviewPayloadT = z.infer<typeof ReviewPayload>;

export const Stage1Request = z.object({
  question: z.string().min(1),
  board: z.array(BoardMemberPayload).min(2),
});

export const Stage2Request = z.object({
  question: z.string().min(1),
  board: z.array(BoardMemberPayload).min(2),
  responses: z.record(z.string(), z.string().min(1)),
});

export const Stage2Response = z.object({
  reveal: z.record(z.string(), z.string()),
  reviews: z.array(
    z.object({
      reviewerId: z.string(),
      payload: ReviewPayload,
    }),
  ),
});

export const Stage3Request = z.object({
  question: z.string().min(1),
  board: z.array(BoardMemberPayload).min(2),
  chairmanId: z.string().min(1),
  responses: z.record(z.string(), z.string().min(1)),
  reviews: z.array(
    z.object({
      reviewerId: z.string(),
      payload: ReviewPayload,
    }),
  ),
});

export type Stage1Event =
  | { type: 'start'; memberId: string }
  | { type: 'token'; memberId: string; text: string }
  | { type: 'done'; memberId: string }
  | { type: 'error'; memberId: string; error: string }
  | { type: 'finish' };
