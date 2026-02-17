import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";

const backendUrl =
  process.env.NEXT_PUBLIC_COPILOTKIT_URL || "http://127.0.0.1:8000";

const arenaCommentator = new HttpAgent({
  url: `${backendUrl}/agent`,
});

const runtime = new CopilotRuntime({
  agents: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "arena-commentator": arenaCommentator as any,
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
