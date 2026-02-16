import { motion } from "framer-motion";

const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex items-center space-x-1 p-3 bg-white rounded-2xl rounded-bl-none shadow-md"
  >
    <motion.div
      animate={{
        y: [0, -4, 0],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0,
      }}
      className="w-2 h-2 bg-gray-400 rounded-full"
    />
    <motion.div
      animate={{
        y: [0, -4, 0],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0.2,
      }}
      className="w-2 h-2 bg-gray-400 rounded-full"
    />
    <motion.div
      animate={{
        y: [0, -4, 0],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0.4,
      }}
      className="w-2 h-2 bg-gray-400 rounded-full"
    />
  </motion.div>
);
export default TypingIndicator;
