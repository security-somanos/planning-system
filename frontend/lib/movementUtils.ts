import { Movement } from "./types";

/**
 * Calculates the arrival time for a movement.
 * If toTimeType is "fixed", returns the fixed toTime.
 * If toTimeType is "driving", calculates fromTime + driving duration.
 */
export function calculateArrivalTime(movement: Movement): string {
  if (movement.toTimeType === "fixed") {
    return movement.toTime;
  }
  
  // Calculate arrival time from departure time + driving duration
  const [fromHours, fromMinutes] = movement.fromTime.split(":").map(Number);
  const drivingHours = movement.drivingTimeHours || 0;
  const drivingMinutes = movement.drivingTimeMinutes || 0;
  
  let totalMinutes = fromMinutes + drivingMinutes;
  let totalHours = fromHours + drivingHours + Math.floor(totalMinutes / 60);
  totalMinutes = totalMinutes % 60;
  
  // Handle day overflow (if needed, could be extended)
  totalHours = totalHours % 24;
  
  return `${String(totalHours).padStart(2, "0")}:${String(totalMinutes).padStart(2, "0")}`;
}

/**
 * Gets the start time for a movement (always fromTime).
 */
export function getMovementStartTime(movement: Movement): string {
  return movement.fromTime;
}

