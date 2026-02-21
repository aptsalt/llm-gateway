import type { TenantContext } from "../middleware/tenant.js";
import { ProviderRegistry } from "./registry.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GroqProvider } from "./groq.js";
import { TogetherProvider } from "./together.js";
import { canUsePlatformFallback } from "../billing/plans.js";

export function createTenantProviderRegistry(
  tenant: TenantContext,
  globalRegistry: ProviderRegistry
): ProviderRegistry {
  const tenantRegistry = new ProviderRegistry();

  // Always add Ollama (platform-provided, free)
  const ollamaProvider = globalRegistry.get("ollama");
  if (ollamaProvider) {
    tenantRegistry.register(ollamaProvider);
  }

  // Add providers from tenant's own API keys
  const keys = tenant.providerKeys;

  if (keys.openai) {
    tenantRegistry.register(new OpenAIProvider(keys.openai));
  }
  if (keys.anthropic) {
    tenantRegistry.register(new AnthropicProvider(keys.anthropic));
  }
  if (keys.groq) {
    tenantRegistry.register(new GroqProvider(keys.groq));
  }
  if (keys.together) {
    tenantRegistry.register(new TogetherProvider(keys.together));
  }

  // For paid plans: add platform providers as fallback
  if (canUsePlatformFallback(tenant.plan)) {
    for (const provider of globalRegistry.getAll()) {
      if (!tenantRegistry.get(provider.id)) {
        tenantRegistry.register(provider);
      }
    }
  }

  return tenantRegistry;
}
