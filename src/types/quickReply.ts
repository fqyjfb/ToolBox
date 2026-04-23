export interface QuickReplyCategory {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  order: number;
  created_at: string;
  updated_at: string;
  children?: QuickReplyCategory[];
}

export interface QuickReply {
  id: string;
  user_id: string;
  category_id: string | null;
  content: string;
  created_at: string;
  category?: QuickReplyCategory;
}

export interface CreateQuickReplyCategoryRequest {
  user_id: string;
  name: string;
  parent_id?: string | null;
}

export interface CreateQuickReplyRequest {
  user_id: string;
  category_id?: string | null;
  content: string;
}