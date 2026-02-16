import axios from "axios";
import type { Message, RoutineContent } from "../entities/types";
import { datadogRum } from "@datadog/browser-rum";

if (window.location.hostname === "localhost") {
  axios.defaults.baseURL = "http://localhost:8000/api/v1";
} else {
  axios.defaults.baseURL = "https://api.skinnova.beauty/api/v1";
}

const api = axios.create({
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

async function chatLLM(prompt: Message[]): Promise<string|RoutineContent> {
  try {
    var langPrompt = {
      messages: prompt,
    };
    const start = performance.now();
    const response = await api.post("/llm/chat", langPrompt);
    datadogRum.addTiming("llm_time_to_first_token", performance.now() - start);
    datadogRum.addAction("backend_api_called", {
      endpoint: "/llm/chat",
      method: "POST",
    });
    if (response.status !== 200) {
      console.error("Error communicating with LLM API:", response.data);
      return Promise.reject("Something went wrong with LLM API");
    } else {
      if (!response.data || !response.data.result) {
        return Promise.reject("No response from LLM API");
      }
      return response.data.result;
    }
  } catch (error) {
    datadogRum.addError(error, {
      source: "chat_api",
      endpoint: "/api/chat",
      userAction: "send_message",
    });
    console.error("Error communicating with LLM API:", error);
    throw error;
  }
}

export { chatLLM };
