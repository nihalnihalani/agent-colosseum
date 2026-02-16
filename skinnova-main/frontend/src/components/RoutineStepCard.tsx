import cleanser from "../assets/cleanser.jpeg";
import serum from "../assets/serum.webp";
import cream from "../assets/cream.avif";
import sunscreen from "../assets/sunscreen.webp";
import defaultImage from "../assets/default.avif";

const getImageUrlForCategory = (category: string): string => {
  const lowerCaseCategory = category.toLowerCase();

  if (lowerCaseCategory.includes("cleanser")) {
    return cleanser;
  }
  if (lowerCaseCategory.includes("serum")) {
    return serum;
  }
  if (
    lowerCaseCategory.includes("cream") ||
    lowerCaseCategory.includes("moisturizer")
  ) {
    return cream;
  }
  if (lowerCaseCategory.includes("sunscreen")) {
    return sunscreen;
  }

  return defaultImage;
};

interface RoutineStep {
  step_number: number;
  product_category: string;
  key_ingredients: string[];
  usage_instructions: string;
  frequency: string;
}

interface RoutineStepCardProps {
  step: RoutineStep;
  openModal: (step: RoutineStep) => void;
}

const RoutineStepCard: React.FC<RoutineStepCardProps> = ({
  step,
  openModal,
}) => (
  <div
    onClick={() => openModal(step)}
    className="flex-shrink-0 w-36 bg-white rounded-xl shadow-lg p-3 cursor-pointer hover:shadow-xl transition-all duration-300 border border-gray-100 transform hover:scale-[1.02]"
  >
    <img
      src={getImageUrlForCategory(step.product_category)}
      alt={step.product_category}
      className="w-full h-20 object-cover rounded-lg mb-2"
      // Fallback for image loading error
      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src =
          "https://placehold.co/100x80/e0e0e0/333?text=Product";
      }}
    />

    <p className="text-sm font-medium text-gray-800 truncate text-center">
      {step.product_category}
    </p>
    <div className="flex items-center justify-center text-xs text-gray-500 mt-1">
      {step.frequency}
    </div>
  </div>
);

export default RoutineStepCard;
