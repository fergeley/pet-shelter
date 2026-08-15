export type BulletinCategory = 'announcement' | 'urgent_need' | 'event' | 'happy_tail' | 'clinic';
export type BulletinTargetPage = 'all' | 'home' | 'pets' | 'bulletins';
export type BulletinMediaType = 'image' | 'video' | 'none';

export interface Bulletin {
  id: string;
  title: string;
  content: string;
  category: BulletinCategory;
  targetPage: BulletinTargetPage;
  mediaType: BulletinMediaType;
  mediaUrl?: string; // Image URL or Direct Video MP4 URL
  videoEmbedUrl?: string; // YouTube / Vimeo embed URL
  isPinned?: boolean;
  createdAt: string;
  author: string;
}

export interface BulletinFormData {
  title: string;
  content: string;
  category: BulletinCategory;
  targetPage: BulletinTargetPage;
  mediaType: BulletinMediaType;
  mediaUrl?: string;
  videoEmbedUrl?: string;
  isPinned?: boolean;
  author: string;
}
