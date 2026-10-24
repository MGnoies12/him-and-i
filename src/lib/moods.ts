import { Smile, Leaf, Heart, CloudMoon, CloudRain, Wind, DoorOpen, HandHeart } from 'lucide-react';
export const moods = [
  { id: 'happy', fa: 'خوشحال', en: 'Happy', icon: Smile },
  { id: 'calm', fa: 'آرام', en: 'Calm', icon: Leaf },
  { id: 'missing', fa: 'دلتنگ', en: 'Missing you', icon: Heart },
  { id: 'tired', fa: 'خسته', en: 'Tired', icon: CloudMoon },
  { id: 'sad', fa: 'غمگین', en: 'Sad', icon: CloudRain },
  { id: 'stressed', fa: 'پراسترس', en: 'Stressed', icon: Wind },
  { id: 'space', fa: 'کمی خلوت', en: 'Need space', icon: DoorOpen },
  { id: 'support', fa: 'نیاز به همراهی', en: 'Need support', icon: HandHeart },
] as const;
export type MoodKind = (typeof moods)[number]['id'];
