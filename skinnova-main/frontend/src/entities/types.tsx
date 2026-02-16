export interface RoutineStep {
  step_number: number;
  product_category: string;
  key_ingredients: string[];
  usage_instructions: string;
  frequency: string;
}

export interface Profile {
  age: string;
  skin_type: string;
  concerns: string[];
}

export interface RoutineData {
  profile: Profile;
  warnings: string[];
  morning_routine: RoutineStep[];
  evening_routine: RoutineStep[];
  night_routine: RoutineStep[];
}


export interface RoutineContent {
  type: "routine";
  data: RoutineData;
}

export type MessageContent = string | RoutineContent;

export interface Message {
  role : "human" | "ai";
  content: MessageContent;
}
