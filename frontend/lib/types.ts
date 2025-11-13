export type BlockType = "activity" | "break";

export type ID = string;

export interface Event {
  id: ID;
  name: string;
  description?: string;
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string; // ISO date (YYYY-MM-DD)
}

export interface Day {
  id: ID;
  eventId: ID;
  date: string; // ISO date (YYYY-MM-DD)
  blocks: Block[] | null; // ordered, may be null
  movements: Movement[] | null; // ordered, may be null
}

export interface ScheduleItem {
  id: ID;
  time: string; // HH:mm
  description: string; // e.g., "His All Holiness begins participation in Program"
  staffInstructions?: string;
  guestInstructions?: string;
  notes?: string; // Additional notes for this schedule item
}

export interface Block {
  id: ID;
  type: BlockType;
  title: string;
  description?: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm (fixed end time, or ignored if endTimeFixed is false)
  endTimeFixed?: boolean; // if false, endTime is auto-calculated from latest schedule item
  locationId?: ID;
  participantsIds: ID[];
  advanceParticipantIds?: ID[]; // Participants who will be there before the event starts
  metByParticipantIds?: ID[]; // Participants who will meet/greet
  attachments: string[]; // file names or URLs
  notes?: string; // Notes for the event/block
  // Schedule items (timeline within the block)
  scheduleItems: ScheduleItem[]; // ordered by time
}

export type ToTimeType = "fixed" | "driving";
export type DrivingTimeUnit = "hours" | "minutes";

export interface VehicleAssignment {
  vehicleId: ID;
  driverId?: ID; // Participant ID who is the driver
  participantIds?: ID[]; // Participants riding in this vehicle
}

export interface Movement {
  id: ID;
  dayId: ID;
  title: string;
  description?: string;
  fromLocationId: ID;
  toLocationId: ID;
  fromTime: string; // HH:mm (always fixed - departure time)
  toTimeType: ToTimeType; // "fixed" (arrival time) or "driving" (driving duration)
  toTime: string; // HH:mm if fixed, or total minutes as string if driving
  drivingTimeHours?: number; // Hours component if driving
  drivingTimeMinutes?: number; // Minutes component if driving
  vehicleAssignments: VehicleAssignment[] | null; // may be null
  notes?: string;
}

export interface Participant {
  id: ID;
  name: string;
  roles: string[]; // multiple roles (e.g., Drivers, Reporters, Directors, etc.)
  email?: string;
  phone?: string;
  languages?: string[]; // languages spoken (e.g., ["English", "Spanish", "French"])
  userId?: ID;
  assignedBlockIds?: ID[] | null; // may be null
  isPasswordSet: boolean; // Indicates if the participant has a password set (read-only)
  isUserEnabled?: boolean | null; // Indicates if the user account is enabled for login (null if no user account exists)
}

export type LocationType = "hotel" | "venue" | "restaurant" | "generic";

export interface Location {
  id: ID;
  name: string;
  address?: string;
  googleMapsLink?: string;
  type: LocationType;
  contact?: string[]; // Array of contact information (phone, email, etc.)
  siteManagerIds?: string[]; // Array of participant IDs who manage this location
}

export interface Vehicle {
  id: ID;
  label: string; // e.g., "Car 1", "Van A", "Bus 1"
  make?: string; // e.g., "Toyota", "Mercedes"
  model?: string; // e.g., "Camry", "Sprinter"
  licensePlate?: string;
  capacity?: number; // number of seats
  availableFrom?: string; // HH:mm - when vehicle becomes available
  availableTo?: string; // HH:mm - when vehicle is available until
  originationLocationId?: ID; // Location where vehicle starts to be available
  notes?: string;
}

export interface Store {
  version: number;
  events: Event[];
  days: Day[];
  participants: Participant[];
  locations: Location[];
  vehicles: Vehicle[];
}

export interface ApiListResponse<T> {
  items: T[];
}

export interface ApiItemResponse<T> {
  item: T;
}


