import API_BASE_URL from '../config/api';

export interface NewsArticleItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  image?: string;
  views: number;
  likes: number;
  publishedAt: string; // ISO
  body?: string;
  isActive?: boolean;
}

export interface CreateNewsArticlePayload {
  title: string;
  summary: string;
  category?: string;
  image?: string;
  body?: string;
  publishedAt?: string;
}

class NewsFeedApi {
  private base = `${API_BASE_URL}/news-feed`;

  async getArticles(activeOnly = true): Promise<NewsArticleItem[]> {
    try {
      const url = `${this.base}?activeOnly=${activeOnly}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('სიახლეების ჩატვირთვა ვერ მოხერხდა');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) return json.data;
      return [];
    } catch (e) {
      console.error('NewsFeedApi.getArticles:', e);
      return [];
    }
  }

  async getArticle(id: string): Promise<NewsArticleItem | null> {
    try {
      const res = await fetch(`${this.base}/${id}`);
      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) return json.data;
      return null;
    } catch (e) {
      console.error('NewsFeedApi.getArticle:', e);
      return null;
    }
  }

  async create(payload: CreateNewsArticlePayload): Promise<{ success: boolean; data?: NewsArticleItem; message?: string }> {
    try {
      const res = await fetch(this.base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, message: json.message || 'დამატება ვერ მოხერხდა' };
      }
      return { success: true, data: json.data, message: json.message };
    } catch (e) {
      console.error('NewsFeedApi.create:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  async update(
    id: string,
    payload: Partial<CreateNewsArticlePayload & { isActive: boolean }>
  ): Promise<{ success: boolean; data?: NewsArticleItem; message?: string }> {
    try {
      const res = await fetch(`${this.base}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, message: json.message || 'განახლება ვერ მოხერხდა' };
      }
      return { success: true, data: json.data, message: json.message };
    } catch (e) {
      console.error('NewsFeedApi.update:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  async delete(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${this.base}/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, message: json.message || 'წაშლა ვერ მოხერხდა' };
      }
      return { success: true, message: json.message };
    } catch (e) {
      console.error('NewsFeedApi.delete:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  async incrementView(id: string): Promise<void> {
    try {
      await fetch(`${this.base}/${id}/view`, { method: 'POST' });
    } catch (e) {
      console.error('NewsFeedApi.incrementView:', e);
    }
  }
}

export const newsFeedApi = new NewsFeedApi();
export default newsFeedApi;
