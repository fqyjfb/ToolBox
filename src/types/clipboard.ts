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

export interface CreateClipboardCategory {
  user_id: string;
  name: string;
}

export interface CreateClipboardItem {
  category_id: string | null;
  user_id: string;
  content: string;
}

export interface UpdateClipboardCategory {
  name: string;
}

export interface UpdateClipboardItem {
  category_id?: string | null;
  content?: string;
}
