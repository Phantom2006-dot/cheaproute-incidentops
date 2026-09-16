import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { analyzeIncident } from "./incidentops/core";
import { persistAnalysis } from "./incidentops/db";
import { createSpeechmaticsRealtimeToken } from "./incidentops/speechmatics";
import { runVerifiedSimulation } from "./incidentops/simulation";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  incidentOps: router({
    status: publicProcedure.query(() => ({
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      speechmaticsConfigured: Boolean(process.env.SPEECHMATICS_API_KEY),
      neonConfigured: Boolean(process.env.INCIDENTOPS_DATABASE_URL),
      zeroCostMode: true,
    })),
    analyze: publicProcedure
      .input(z.object({ transcript: z.string().trim().min(1).max(2_000), source: z.enum(["text", "speechmatics"]).default("text") }))
      .mutation(async ({ ctx, input }) => {
        const result = await analyzeIncident(input.transcript, input.source);
        const principalId = ctx.user?.openId ?? "demo-public";
        try {
          const persistence = await persistAnalysis(principalId, result);
          return { ...result, persistence };
        } catch {
          return { ...result, persistence: { persisted: false, mode: "fallback_after_db_error" as const }, warnings: [...result.warnings, "Neon persistence failed for this run; the analysis remains available in the demo."] };
        }
      }),
    speechmaticsToken: publicProcedure.mutation(async () => createSpeechmaticsRealtimeToken()),
    simulate: publicProcedure
      .input(z.object({ approve: z.boolean().default(true) }))
      .mutation(({ input }) => runVerifiedSimulation(input.approve)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
