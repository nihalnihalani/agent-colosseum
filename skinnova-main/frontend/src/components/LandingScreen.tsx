import { motion } from "framer-motion";
import { Send, Heart, MessageSquare } from "lucide-react";
import landingPageImage from "../assets/landingpage.webp";
import { useState } from "react";

const handleKeyPress = (
  e: React.KeyboardEvent<HTMLInputElement>,
  handler: () => void
): void => {
  if (e.key === "Enter") {
    handler();
  }
};

interface LandingScreenProps {
  landingInput: string;
  setLandingInput: React.Dispatch<React.SetStateAction<string>>;
  handleStartChat: (msg: string) => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ handleStartChat }) => {
  const [landingInput, setLandingInput] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col h-full p-8"
    >
      {/* Header with dots */}
      <div className="flex space-x-1 mb-4">
        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
      </div>

      {/* Main content inspired by GIF */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Background Image for the Landing Screen */}
        <div
          className="absolute inset-0 bg-cover bg-center rounded-2xl opacity-70 overflow-hidden"
          style={{
            backgroundImage: `url('${landingPageImage}')`,
          }}
        ></div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-96 bg-white/90 backdrop-blur-sm p-6 rounded-3xl shadow-2xl border border-gray-100">
          <div className="flex items-center justify-center mb-4">
            <MessageSquare size={32} className="text-gray-600" />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 mb-2">
            Ask me a question
          </h2>
          <div className="flex items-center bg-gray-100 p-2 rounded-xl mt-4">
            <input
              value={landingInput}
              onChange={(e) => setLandingInput(e.target.value)}
              onKeyDown={(e) =>
                handleKeyPress(e, () => handleStartChat(landingInput))
              }
              type="text"
              placeholder="Type something..."
              className="bg-transparent outline-none w-full text-sm p-1"
              autoFocus
            />
            <button
              onClick={() => handleStartChat(landingInput)}
              className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg bg-black text-white hover:bg-rose-600 transition"
              aria-label="Start chat"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        <p className="absolute bottom-0 left-0 text-sm font-semibold tracking-widest text-gray-700">
          SKINNOVA
        </p>
      </div>

      {/* Footer */}
      <div className="flex justify-center items-center">
        <Heart
          size={20}
          className="text-red-500 cursor-pointer"
          fill="currentColor"
        />
      </div>
    </motion.div>
  );
};

export default LandingScreen;
