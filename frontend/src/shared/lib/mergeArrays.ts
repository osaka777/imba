export const mergeArrays = <T>(a: T[], b: T[], id: string) => {
  // Create a map for quick lookup of events by eventId from array1
  const map = new Map<number, T>();
  for (const event of a) {
    //@ts-expect-error abc
    map.set(event[id], event);
  }

  // Update the map with events from array2 or add new ones
  for (const event of b) {
    //@ts-expect-error abc
    map.set(event[id], event);
  }

  // Collect all unique events from the map into a merged array
  const mergedArray = Array.from(map.values());

  return mergedArray;
};
