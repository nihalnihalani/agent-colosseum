import { motion } from "framer-motion";
import { X, Star, ArrowRight, AlertTriangle, User } from "lucide-react";

interface RoutineStep {
  step_number: number;
  product_category: string;
  key_ingredients: string[];
  usage_instructions: string;
  frequency: string;
}

interface Profile {
  age: string;
  skin_type: string;
  concerns: string[];
}

interface RoutineDetailModalProps {
  step: RoutineStep | null;
  warnings: string[];
  profile: Profile | null;
  onClose: () => void;
}

const RoutineDetailModal: React.FC<RoutineDetailModalProps> = ({
  step,
  warnings,
  profile,
  onClose,
}) => {
  if (!step) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="bg-white w-full max-w-sm md:max-w-md rounded-2xl shadow-2xl p-6 relative overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {step.product_category}
        </h2>
        <p className="text-sm text-rose-600 font-medium mb-4">
          Step {step.step_number}
        </p>

        {/* Key Information */}
        <div className="space-y-4 mb-6">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-700 flex items-center mb-1">
              <Star
                size={16}
                className="text-yellow-500 mr-2"
                fill="currentColor"
              />{" "}
              Key Ingredients
            </h3>
            {/* Displaying ingredients as a list */}
            <ul className="list-disc ml-4 text-sm text-gray-600 space-y-0.5">
              {step.key_ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <h3 className="font-semibold text-gray-700 flex items-center mb-1">
              <ArrowRight size={16} className="text-rose-500 mr-2" /> Usage
              Instructions
            </h3>
            <p className="text-sm text-gray-600">{step.usage_instructions}</p>
          </div>

          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 flex justify-between items-center">
            <span className="font-semibold text-gray-700">Frequency:</span>
            <span className="text-sm text-indigo-700 font-medium uppercase">
              {step.frequency}
            </span>
          </div>
        </div>

        {/* Profile and Warnings */}
        {warnings && (
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg mb-4">
            <h3 className="font-bold text-yellow-700 flex items-center mb-2">
              <AlertTriangle size={16} className="mr-2" /> IMPORTANT WARNINGS
            </h3>
            <ul className="list-disc ml-4 text-sm text-yellow-800 space-y-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {profile && (
          <div className="text-xs text-gray-500 pt-2 border-t">
            <span className="font-semibold flex items-center">
              <User size={12} className="mr-1" /> Profile Context:
            </span>
            <p>
              Type: {profile.skin_type} ({profile.concerns.join(", ")}) | Age:{" "}
              {profile.age}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
export default RoutineDetailModal;
