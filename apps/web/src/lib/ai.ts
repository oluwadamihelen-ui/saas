import { ModelRouter, ProviderRegistry } from "@cinerra/ai";
import { env } from "./env";

const globalForAi = globalThis as unknown as { registry?: ProviderRegistry; router?: ModelRouter };

export const providerRegistry = globalForAi.registry ?? new ProviderRegistry(env);
export const modelRouter = globalForAi.router ?? new ModelRouter(providerRegistry);

if (process.env.NODE_ENV !== "production") {
  globalForAi.registry = providerRegistry;
  globalForAi.router = modelRouter;
}
