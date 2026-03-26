export interface ArcTarget {
  id: string;
  latitude: number;
  longitude: number;
}

export interface LiveCard {
  id: string;
  frontImageUrl: string;
  latitude: number;
  longitude: number;
  senderName?: string;
  message?: string;
  country?: string;
}
