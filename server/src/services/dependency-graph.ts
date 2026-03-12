/**
 * Dependency graph utilities for subtask ordering.
 *
 * Uses Kahn's algorithm (BFS-based topological sort) to order subtasks
 * by their dependency relationships and detect cycles.
 */

export interface DependencyEdge {
  issueId: string;
  dependsOnId: string;
}

/**
 * BFS-based topological sort using Kahn's algorithm.
 *
 * @param issueIds - All node IDs in the graph
 * @param edges - Directed edges where issueId depends on dependsOnId
 * @returns Ordered array of issueIds (dependencies first)
 * @throws Error if a cycle is detected
 */
export function topologicalSort(issueIds: string[], edges: DependencyEdge[]): string[] {
  // Build adjacency list and in-degree map
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of issueIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    // dependsOnId -> issueId (dependsOnId must come before issueId)
    adjacency.get(edge.dependsOnId)?.push(edge.issueId);
    inDegree.set(edge.issueId, (inDegree.get(edge.issueId) ?? 0) + 1);
  }

  // Initialize queue with nodes that have no incoming edges
  const queue: string[] = [];
  for (const id of issueIds) {
    if (inDegree.get(id) === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== issueIds.length) {
    throw new Error("Cycle detected in subtask dependencies");
  }

  return sorted;
}

/**
 * Validates that a set of edges form a DAG (no cycles).
 *
 * @returns true if the graph is acyclic, false if a cycle exists
 */
export function validateNoCycle(issueIds: string[], edges: DependencyEdge[]): boolean {
  try {
    topologicalSort(issueIds, edges);
    return true;
  } catch {
    return false;
  }
}

/**
 * Groups tasks into execution waves for parallel processing.
 *
 * Wave 1 contains tasks with no dependencies.
 * Wave N contains tasks whose dependencies are all in earlier waves.
 *
 * @returns Array of waves, where each wave is an array of issue IDs
 * @throws Error if a cycle is detected
 */
export function getExecutionWaves(issueIds: string[], edges: DependencyEdge[]): string[][] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of issueIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    adjacency.get(edge.dependsOnId)?.push(edge.issueId);
    inDegree.set(edge.issueId, (inDegree.get(edge.issueId) ?? 0) + 1);
  }

  const waves: string[][] = [];
  let remaining = issueIds.length;

  // Start with all nodes that have in-degree 0
  let currentWave: string[] = [];
  for (const id of issueIds) {
    if (inDegree.get(id) === 0) {
      currentWave.push(id);
    }
  }

  while (currentWave.length > 0) {
    waves.push(currentWave);
    remaining -= currentWave.length;

    const nextWave: string[] = [];
    for (const node of currentWave) {
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          nextWave.push(neighbor);
        }
      }
    }

    currentWave = nextWave;
  }

  if (remaining > 0) {
    throw new Error("Cycle detected in subtask dependencies");
  }

  return waves;
}
