interface IdentifiedItem {
  id: string
}

export function prependOptimistic<Item>(items: Item[], optimisticItem: Item): Item[] {
  return [optimisticItem, ...items]
}

export function replaceOptimistic<Item extends IdentifiedItem>(
  items: Item[],
  optimisticId: string,
  persistedItem: Item
): Item[] {
  return items.map((item) => (item.id === optimisticId ? persistedItem : item))
}

export function removeOptimistic<Item extends IdentifiedItem>(items: Item[], itemId: string): Item[] {
  return items.filter((item) => item.id !== itemId)
}
