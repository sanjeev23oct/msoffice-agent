export interface Insight {
  id: string;
  type: 'follow_up' | 'deadline' | 'pattern' | 'suggestion';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  relatedItems: RelatedItem[];
  createdAt: Date;
}

export interface RelatedItem {
  type: 'email' | 'note' | 'meeting';
  id: string;
  title: string;
}
