"use client";

import "@copilotkit/react-ui/styles.css";
import { CopilotKit } from "@copilotkit/react-core";

interface Props {
  children: React.ReactNode;
}

export function CopilotKitProvider({ children }: Props) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="arena-commentator" showDevConsole={false}>
      {children}
    </CopilotKit>
  );
}
