import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";

const backendUrl =
  process.env.NEXT_PUBLIC_COPILOTKIT_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const arenaCommentator = new HttpAgent({
  url: `${backendUrl}/copilotkit_api`,
});

const runtime = new CopilotRuntime({
  // HttpAgent is structurally compatible with AbstractAgent at runtime.
  // The two-step cast (value → unknown → target) is used here to bridge the
  // module-identity mismatch between the top-level @ag-ui/client (v0.0.45) and
  // the copy nested inside @copilotkit/runtime (v0.0.42), without disabling
  // downstream type-checking the way `as any` would.
  agents: {
    "arena-commentator": arenaCommentator,
  } as unknown as Record<string, never>,
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
