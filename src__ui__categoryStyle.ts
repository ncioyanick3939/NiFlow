import type { Category } from '../domain/types'

// Vollständige Klassennamen, damit Tailwind sie beim Build erkennt.
export const CATEGORY_STYLE: Record<Category, { bar: string; text: string }> = {
  training: { bar: 'bg-training', text: 'text-training' },
  work: { bar: 'bg-work', text: 'text-work' },
  study: { bar: 'bg-study', text: 'text-study' },
  private: { bar: 'bg-private', text: 'text-private' },
}
