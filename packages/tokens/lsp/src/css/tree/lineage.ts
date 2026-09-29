export default function findLineageNode<
  T extends { name: string; parent: T | null },
>(node: T | null, name: string): T | null {
  let current = node;
  while (current) {
    if (current.name === name) return current;
    current = current.parent;
  }
  return null;
}
