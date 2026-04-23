// 分类类型定义
export interface Category {
  id: string
  name: string
  parent_id: string | null
  order: number
  children: Category[]
  created_at: string
  updated_at: string
}

// 书签类型定义
export interface Bookmark {
  id: string
  title: string
  url: string
  description: string
  category_id: string
  user_id: string | null
  is_public: boolean
  is_favorite: boolean
  order: number
  ico_url?: string
  created_at: string
  updated_at: string
  category?: Category
}