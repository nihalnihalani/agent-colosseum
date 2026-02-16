import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import ChatBubble from "./ChatBubble";
import TypingIndicator from "./TypingIndicator";
import type { Message, Profile, RoutineStep } from "../entities/types";

const handleKeyPress = (
  e: React.KeyboardEvent<HTMLInputElement>,
  handler: () => void
): void => {
  if (e.key === "Enter") {
    handler();
  }
};

interface ChatbotScreenProps {
  messages: Message[];
  isTyping: boolean;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sendMessage: (msg: string) => void;
  openModal: (step: RoutineStep, warnings: string[], profile: Profile) => void;
  chatRef: React.RefObject<HTMLDivElement | null>;
}

const ChatbotScreen: React.FC<ChatbotScreenProps> = ({
  messages,
  isTyping,
  input,
  setInput,
  sendMessage,
  openModal,
  chatRef,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col h-full overflow-hidden"
    >
      <div className="p-4 flex justify-center items-center border-b bg-white shadow-sm">
        <div className="flex flex-col items-center">
          <p className="text-sm font-semibold text-gray-800">Skinnova AI</p>
          <p className="text-xs text-gray-500">Online</p>
        </div>
      </div>

      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <ChatBubble
              key={index}
              role={msg.role}
              content={msg.content}
              openModal={openModal}
            />
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
      </div>

      <div className="p-4 bg-white flex items-center gap-3 border-t shadow-inner">
        <div className="flex items-center bg-gray-100 p-3 rounded-full flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => handleKeyPress(e, () => sendMessage(input))}
            type="text"
            placeholder="Ask the AI"
            className="bg-transparent outline-none w-full text-sm"
          />
        </div>

        <button
          onClick={() => sendMessage(input)}
          disabled={isTyping}
          className={`w-12 h-12 flex items-center justify-center rounded-full transition ${
            input.trim()
              ? "bg-rose-500 text-white hover:bg-rose-600"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          aria-label="Send message"
        >
          {isTyping ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default ChatbotScreen;
