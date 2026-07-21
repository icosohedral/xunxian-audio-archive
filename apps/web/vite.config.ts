import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";
const VISITS_DATABASE_ID = "c916e43e-4e69-4a1e-8c67-a23ebd1a5896";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  workers_dev: true,
  preview_urls: false,
  routes: [
    {
      pattern: "music.xunxian.wiki",
      custom_domain: true,
    },
  ],
  vars: {
    AUDIO_ENABLED: "true",
  },
  ratelimits: [
    {
      name: "SIGN_RATE_LIMITER",
      namespace_id: "1001",
      simple: { limit: 30, period: 60 as const },
    },
    {
      name: "AUDIO_RATE_LIMITER",
      namespace_id: "1002",
      simple: { limit: 180, period: 60 as const },
    },
    {
      name: "VISIT_RATE_LIMITER",
      namespace_id: "1003",
      simple: { limit: 30, period: 60 as const },
    },
  ],
  d1_databases: [
    {
      binding: "VISITS_DB",
      database_name: "xunxian-visits",
      database_id: VISITS_DATABASE_ID,
    },
    ...(d1
      ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
      : []),
  ],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "xunxian-audio",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
