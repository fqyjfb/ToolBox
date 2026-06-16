export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  date: string;
  done: boolean;
}

export type ChatTarget = 'journal' | 'later' | 'read' | 'watch' | 'shop' | 'archive';

export interface ChatState {
  messages: ChatMessage[];
  isChatMode: boolean;
  selectedMessages: string[];
}