import { useState, useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import type { Message, Profile, RoutineStep } from "./entities/types";
import ChatbotScreen from "./components/ChatbotScreen";
import LandingScreen from "./components/LandingScreen";
import RoutineDetailModal from "./components/RoutineDetailModal";
import { chatLLM } from "./services/api";
import { datadogRum } from "@datadog/browser-rum";
import logoSVG from "./assets/logo.svg";

const App: React.FC = () => {
  const [isChatting, setIsChatting] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [landingInput, setLandingInput] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedStepDetail, setSelectedStepDetail] =
    useState<RoutineStep | null>(null);
  const [currentWarnings, setCurrentWarnings] = useState<string[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    var ele = '<link rel="icon" href="' + logoSVG + '" sizes="any" type="image/svg+xml">';
    document.head.insertAdjacentHTML("beforeend", ele);
  },[]);

  const openModal = (
    stepData: RoutineStep,
    warnings: string[],
    profile: Profile
  ) => {
    setSelectedStepDetail(stepData);
    setCurrentWarnings(warnings);
    setCurrentProfile(profile);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedStepDetail(null);
    setCurrentWarnings([]);
    setCurrentProfile(null);
  };

  const sendMessage = (msg: string) => {
    datadogRum.addAction("chat_message_sent", {
      messageLength: msg.length,
      containsRoutineRequest: msg.toLowerCase().includes("routine"),
      timestamp: Date.now(),
    });
    if (!msg.trim()) return;

    const userMsg: Message = {
      role: "human",
      content: msg,
    };
    const newMessages: Message[] = [...messages, userMsg];
    setInput("");
    setMessages(newMessages);
    setIsChatting(true);
    setIsTyping(true);

    chatLLM(newMessages)
      .then((response) => {
        setMessages((prev) => [...prev, { role: "ai", content: response }]);
        if (typeof response === "string") {          
          datadogRum.addAction("chat_response_received", {
            responseLength: response.length,
            responseType: "general_advice",
          });
        }
      })
      .catch((error) => {
        console.error("LLM chat error:", error);
        datadogRum.addError("Error communicating with LLM API", {
          source: "chat_api",
          endpoint: "/api/chat",
          userAction: "send_message",
        });
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: "Sorry, something went wrong. Please try again later.",
          },
        ]);
      })
      .finally(() => {
        setIsTyping(false);
      });
  };

  return (
    <div className="h-screen w-full flex items-center justify-center p-4 md:p-10 font-sans">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `#f5e3df`,
        }}
      />

      <div className="relative w-full max-w-sm md:max-w-7xl bg-[#fafafa] rounded-3xl shadow-2xl border border-gray-200 overflow-hidden h-[95vh] transition z-20">
        <AnimatePresence mode="wait">
          {isChatting ? (
            <ChatbotScreen
              key="chat"
              messages={messages}
              isTyping={isTyping}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              openModal={openModal}
              chatRef={chatRef}
            />
          ) : (
            <LandingScreen
              key="landing"
              landingInput={landingInput}
              setLandingInput={setLandingInput}
              handleStartChat={sendMessage}
            />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <RoutineDetailModal
            step={selectedStepDetail}
            warnings={currentWarnings}
            profile={currentProfile}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
