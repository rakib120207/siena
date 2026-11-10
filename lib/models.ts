export interface ModelOption {
  id: string | null;
  label: string;
  description: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: null, label: "Default", description: "Uses the model set on the server" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", description: "Most capable" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", description: "Faster and lighter" },
];

export const PRESET_MODEL_IDS: string[] = MODEL_OPTIONS.flatMap((option) =>
  option.id ? [option.id] : []
);

export function modelLabel(id: string | null): string {
  const found = MODEL_OPTIONS.find((option) => option.id === id);
  return found ? found.label : id ?? "Default";
}

export function isReasoningModel(id: string): boolean {
  return id.startsWith("openai/gpt-oss");
}
