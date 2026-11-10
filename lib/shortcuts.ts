export interface ShortcutDef {
  keys: string[];
  label: string;
}

export function getShortcuts(isMac: boolean): ShortcutDef[] {
  const mod = isMac ? "⌘" : "Ctrl";
  const shift = isMac ? "⇧" : "Shift";
  const back = isMac ? "⌫" : "Backspace";
  return [
    { keys: [mod, shift, "O"], label: "New chat" },
    { keys: [mod, "K"], label: "Search chats" },
    { keys: [shift, "Esc"], label: "Focus message box" },
    { keys: [mod, shift, "C"], label: "Copy last response" },
    { keys: [mod, shift, ";"], label: "Copy last code block" },
    { keys: [mod, shift, "S"], label: "Toggle sidebar" },
    { keys: [mod, shift, back], label: "Delete chat" },
    { keys: [mod, shift, "I"], label: "Custom instructions" },
    { keys: [mod, "/"], label: "Show shortcuts" },
    { keys: ["Enter"], label: "Send message" },
    { keys: [shift, "Enter"], label: "New line" },
    { keys: ["Esc"], label: "Close dialog or menu" },
  ];
}
