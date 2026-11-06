/**
 * The type declaration the npm package ships for its Worker (scripts/build-package.mjs copies
 * it to dist/worker/index.d.ts). An instance re-exports the Worker and typechecks only its own
 * code against this, never Lettre's source. The two handlers are declared without Lettre's
 * `Env`, which an instance generates from its own wrangler config; test/worker_types.ts holds
 * this declaration against the real entry (src/index.ts).
 */

/** Lettre's Worker: the HTTP surface and the once-a-minute send sweep (SPEC §6, §11). */
declare const lettre: {
  fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response>;
  scheduled(controller: ScheduledController, env: unknown, ctx: ExecutionContext): Promise<void>;
};

export default lettre;
