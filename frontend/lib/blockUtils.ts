import { Block } from "./types";

/**
 * Calculates the end time for a block.
 * Returns null if the end time cannot be determined (auto mode with no schedule items).
 */
export function calculateEndTime(block: Block): string | null {
  // If endTime is fixed, use it
  if (block.endTimeFixed === true) {
    return block.endTime;
  }
  // Otherwise, calculate from latest schedule item
  if (block.scheduleItems && block.scheduleItems.length > 0) {
    const latest = block.scheduleItems.reduce((latest, item) => {
      return item.time > latest.time ? item : latest;
    }, block.scheduleItems[0]);
    return latest.time;
  }
  // Cannot calculate end time if no schedule items
  return null;
}

