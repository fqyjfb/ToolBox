export interface ClipboardCategory {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ClipboardItem {
  id: string;
  category_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  category?: ClipboardCategory;
}
