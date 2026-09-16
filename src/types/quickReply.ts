export interface QuickReplyCategory {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
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
  updated_at: string;
  category?: QuickReplyCategory;
}