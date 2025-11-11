'use client';

// Re-export real API as mockApi - no longer using mock data
export { api as mockApi } from './api';

// Legacy mock implementation kept below for reference (not used)
/*
import { readFromStorage, writeToStorage } from "./storage";
import { buildSeedStore } from "./mockData";
import { generateId } from "./id";
import {
  ApiItemResponse,
  ApiListResponse,
  Block,
  Day,
  Event,
  ID,
  Location,
  Movement,
  Participant,
  Store,
  Vehicle,
} from "./types";

const STORE_KEY = "ps:mockStore:v1";
const DEFAULT_LATENCY_MS = 250;

let memoryStore: Store | null = null;

function getStore(): Store {
  if (memoryStore) return memoryStore;
  const existing = readFromStorage<Store | null>(STORE_KEY, null);
  if (existing) {
    // Migrate: ensure vehicles array exists
    if (!existing.vehicles) {
      existing.vehicles = [];
    }
    // Migrate: ensure days have movements array
    for (const day of existing.days) {
      if (!day.movements) {
        (day as any).movements = [];
      }
      // Migrate: remove fromTimeType from existing movements (always fixed now)
      for (const m of day.movements) {
        if ("fromTimeType" in m) {
          delete (m as any).fromTimeType;
        }
        // Ensure drivingTimeHours and drivingTimeMinutes exist if driving type
        if ((m as any).toTimeType === "driving" && !("drivingTimeHours" in m)) {
          const totalMinutes = parseInt((m as any).toTime) || 0;
          (m as any).drivingTimeHours = Math.floor(totalMinutes / 60);
          (m as any).drivingTimeMinutes = totalMinutes % 60;
        }
      }
      // Migrate: remove movement blocks and convert to movements
      const movementBlocks = day.blocks.filter((b) => (b as any).type === "movement");
      for (const mb of movementBlocks) {
        const mbAny = mb as any;
        if (mbAny.locationStartId && mbAny.locationEndId) {
          const movement = {
            id: generateId(),
            dayId: day.id,
            title: mb.title,
            description: mb.description,
            fromLocationId: mbAny.locationStartId,
            toLocationId: mbAny.locationEndId,
            fromTime: mb.startTime,
            toTime: mb.endTime,
            toTimeType: "fixed" as const,
            vehicleAssignments: [],
            notes: mb.notes,
          };
          (day as any).movements.push(movement);
        }
      }
      day.blocks = day.blocks.filter((b) => (b as any).type !== "movement");
      // Remove locationStartId and locationEndId from remaining blocks
      for (const block of day.blocks) {
        if ("locationStartId" in block) delete (block as any).locationStartId;
        if ("locationEndId" in block) delete (block as any).locationEndId;
      }
      // Migrate: ensure blocks have scheduleItems, and schedule items have instructions
      for (const block of day.blocks) {
        if (!block.scheduleItems) {
          (block as any).scheduleItems = [];
        }
        // Ensure each schedule item has instructions fields
        for (const item of block.scheduleItems || []) {
          if (!("staffInstructions" in item)) {
            (item as any).staffInstructions = undefined;
          }
          if (!("guestInstructions" in item)) {
            (item as any).guestInstructions = undefined;
          }
        }
        // Remove old block-level instructions if they exist (migrate to schedule items if needed)
        if ("staffInstructions" in block || "guestInstructions" in block) {
          delete (block as any).staffInstructions;
          delete (block as any).guestInstructions;
        }
        // Ensure endTimeFixed exists (default to false/auto for existing blocks)
        if (!("endTimeFixed" in block)) {
          (block as any).endTimeFixed = false;
        }
      }
    }
    writeToStorage(STORE_KEY, existing);
    memoryStore = existing;
    return memoryStore;
  }
  const seeded = buildSeedStore();
  memoryStore = seeded;
  writeToStorage(STORE_KEY, seeded);
  return memoryStore;
}

function saveStore(store: Store): void {
  memoryStore = store;
  writeToStorage(STORE_KEY, store);
}

function sleep(ms = DEFAULT_LATENCY_MS): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function getDefaultEvent(store: Store): Event {
  if (store.events.length === 0) {
    // Create a default event if none exists
    const defaultEvent: Event = {
      id: generateId(),
      name: "Event",
      description: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    };
    store.events.push(defaultEvent);
    saveStore(store);
    return defaultEvent;
  }
  return store.events[0];
}

function findEvent(store: Store, eventId?: ID): Event {
  if (!eventId) return getDefaultEvent(store);
  const event = store.events.find((e) => e.id === eventId);
  if (!event) throw new Error("Event not found");
  return event;
}

function findDay(store: Store, dayId: ID, eventId?: ID): Day {
  const eId = eventId || getDefaultEvent(store).id;
  const day = store.days.find((d) => d.eventId === eId && d.id === dayId);
  if (!day) throw new Error("Day not found");
  return day;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((v) => parseInt(v, 10));
  return h * 60 + m;
}

function sortBlocksChronologically(blocks: Block[]): Block[] {
  return [...blocks].sort((a, b) => {
    const aMin = timeToMinutes(a.startTime);
    const bMin = timeToMinutes(b.startTime);
    if (aMin !== bMin) return aMin - bMin;
    return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  });
}

function removeBlockIdFromParticipants(store: Store, blockId: ID) {
  for (const p of store.participants) {
    if (p.assignedBlockIds) {
      p.assignedBlockIds = p.assignedBlockIds.filter((id) => id !== blockId);
    }
  }
}

function removeParticipantFromBlocks(store: Store, participantId: ID) {
  for (const d of store.days) {
    d.blocks = d.blocks.map((b) => ({
      ...b,
      participantsIds: b.participantsIds.filter((pid) => pid !== participantId),
    }));
  }
}

function removeLocationReferences(store: Store, locationId: ID) {
  for (const d of store.days) {
    d.blocks = d.blocks.map((b) => {
      const updated: Block = { ...b };
      if (updated.locationId === locationId) updated.locationId = undefined;
      return updated;
    });
    // Also remove from movements
    for (const m of d.movements) {
      if (m.fromLocationId === locationId) m.fromLocationId = "" as ID;
      if (m.toLocationId === locationId) m.toLocationId = "" as ID;
    }
  }
}

// Basic path helpers
function splitPath(path: string): string[] {
  return path.replace(/^\/+|\/+$/g, "").split("/");
}

// Re-export real API as mockApi for backward compatibility during transition
// TODO: Replace all imports with lib/api once backend is ready
import { api } from './api';
export const mockApi = api;

const _mockApi = {
  async get<T = unknown>(path: string): Promise<T> {
    await sleep();
    const store = getStore();
    const parts = splitPath(path);

    // /events
    if (parts[0] === "events" && parts.length === 1) {
      const res: ApiListResponse<Event> = { items: store.events };
      return res as unknown as T;
    }

    // /events/:eventId
    if (parts[0] === "events" && parts.length === 2) {
      const eventId = parts[1];
      const event = findEvent(store, eventId);
      const res: ApiItemResponse<Event> = { item: event };
      return res as unknown as T;
    }

    // /days (simplified - single event)
    if (parts[0] === "days" && parts.length === 1) {
      const event = getDefaultEvent(store);
      const items = store.days.filter((d) => d.eventId === event.id);
      const res: ApiListResponse<Day> = { items };
      return res as unknown as T;
    }

    // /days/:dayId (simplified - single event)
    if (parts[0] === "days" && parts.length === 2) {
      const dayId = parts[1];
      const day = findDay(store, dayId);
      const res: ApiItemResponse<Day> = { item: day };
      return res as unknown as T;
    }

    // /events/:eventId/days
    if (parts[0] === "events" && parts[2] === "days" && parts.length === 3) {
      const eventId = parts[1];
      const items = store.days.filter((d) => d.eventId === eventId);
      const res: ApiListResponse<Day> = { items };
      return res as unknown as T;
    }

    // /events/:eventId/days/:dayId
    if (parts[0] === "events" && parts[2] === "days" && parts.length === 4) {
      const eventId = parts[1];
      const dayId = parts[3];
      const day = findDay(store, dayId, eventId);
      const res: ApiItemResponse<Day> = { item: day };
      return res as unknown as T;
    }

    // /days/:dayId/blocks (simplified - single event)
    if (parts[0] === "days" && parts[2] === "blocks" && parts.length === 3) {
      const dayId = parts[1];
      const day = findDay(store, dayId);
      const res: ApiListResponse<Block> = { items: day.blocks };
      return res as unknown as T;
    }

    // /events/:eventId/days/:dayId/blocks
    if (parts[0] === "events" && parts[2] === "days" && parts[4] === "blocks" && parts.length === 5) {
      const eventId = parts[1];
      const dayId = parts[3];
      const day = findDay(store, dayId, eventId);
      const res: ApiListResponse<Block> = { items: day.blocks };
      return res as unknown as T;
    }

    // /participants
    if (parts[0] === "participants" && parts.length === 1) {
      const res: ApiListResponse<Participant> = { items: store.participants };
      return res as unknown as T;
    }

    // /participants/:id
    if (parts[0] === "participants" && parts.length === 2) {
      const p = store.participants.find((x) => x.id === parts[1]);
      if (!p) throw new Error("Participant not found");
      const res: ApiItemResponse<Participant> = { item: p };
      return res as unknown as T;
    }

    // /locations
    if (parts[0] === "locations" && parts.length === 1) {
      const res: ApiListResponse<Location> = { items: store.locations };
      return res as unknown as T;
    }

    // /vehicles
    if (parts[0] === "vehicles" && parts.length === 1) {
      const res: ApiListResponse<Vehicle> = { items: store.vehicles };
      return res as unknown as T;
    }

    // /vehicles/:id
    if (parts[0] === "vehicles" && parts.length === 2) {
      const v = store.vehicles.find((x) => x.id === parts[1]);
      if (!v) throw new Error("Vehicle not found");
      const res: ApiItemResponse<Vehicle> = { item: v };
      return res as unknown as T;
    }

    // /agenda/:participantId
    if (parts[0] === "agenda" && parts.length === 2) {
      const participantId = parts[1];
      const blocks: { eventId: ID; dayId: ID; date: string; block: Block }[] = [];
      for (const day of store.days) {
        for (const b of day.blocks) {
          if (b.participantsIds.includes(participantId)) {
            blocks.push({ eventId: day.eventId, dayId: day.id, date: day.date, block: b });
          }
        }
      }
      // sort by day date then time
      blocks.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return timeToMinutes(a.block.startTime) - timeToMinutes(b.block.startTime);
      });
      return { items: blocks } as unknown as T;
    }

    // /itinerary (simplified - single event)
    if (parts[0] === "itinerary" && parts.length === 1) {
      const event = getDefaultEvent(store);
      const days = store.days
        .filter((d) => d.eventId === event.id)
        .map((d) => ({ ...d, blocks: sortBlocksChronologically(d.blocks) }));
      return { item: { eventId: event.id, days } } as unknown as T;
    }

    // /itinerary/event/:eventId
    if (parts[0] === "itinerary" && parts[1] === "event" && parts.length === 3) {
      const eventId = parts[2];
      findEvent(store, eventId); // validate exists
      const days = store.days
        .filter((d) => d.eventId === eventId)
        .map((d) => ({ ...d, blocks: sortBlocksChronologically(d.blocks) }));
      return { item: { eventId, days } } as unknown as T;
    }

    throw new Error(`Unknown GET path: ${path}`);
  },

  async post<T = unknown>(path: string, body: any): Promise<T> {
    await sleep();
    const store = getStore();
    const parts = splitPath(path);

    // /events
    if (parts[0] === "events" && parts.length === 1) {
      const newEvent: Event = {
        id: generateId(),
        name: body.name ?? "Untitled Event",
        description: body.description ?? "",
        startDate: body.startDate ?? new Date().toISOString().slice(0, 10),
        endDate: body.endDate ?? new Date().toISOString().slice(0, 10),
      };
      store.events.push(newEvent);
      saveStore(store);
      return { item: newEvent } as unknown as T;
    }

    // /days (simplified - single event)
    if (parts[0] === "days" && parts.length === 1) {
      const event = getDefaultEvent(store);
      const newDay: Day = {
        id: generateId(),
        eventId: event.id,
        date: body.date ?? new Date().toISOString().slice(0, 10),
        blocks: [],
        movements: [],
      };
      store.days.push(newDay);
      saveStore(store);
      return { item: newDay } as unknown as T;
    }

    // /days/:dayId/blocks (simplified - single event)
    if (parts[0] === "days" && parts[2] === "blocks" && parts.length === 3) {
      const dayId = parts[1];
      const day = findDay(store, dayId);
      const newBlock: Block = {
        id: generateId(),
        type: body.type,
        title: body.title ?? "Untitled",
        description: body.description ?? "",
        startTime: body.startTime ?? "09:00",
        endTime: body.endTime ?? "10:00",
        endTimeFixed: body.endTimeFixed === true, // Default to false (auto) if not explicitly true
        locationId: body.locationId,
        participantsIds: Array.isArray(body.participantsIds) ? body.participantsIds : [],
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        notes: body.notes ?? "",
        scheduleItems: Array.isArray(body.scheduleItems) ? body.scheduleItems : [],
      };
      day.blocks.push(newBlock);
      // add to participants assignment
      for (const pid of newBlock.participantsIds) {
        const p = store.participants.find((x) => x.id === pid);
        if (p) {
          if (!p.assignedBlockIds) {
            p.assignedBlockIds = [];
          }
          if (!p.assignedBlockIds.includes(newBlock.id)) {
            p.assignedBlockIds.push(newBlock.id);
          }
        }
      }
      saveStore(store);
      return { item: newBlock } as unknown as T;
    }

    // /events/:eventId/days
    if (parts[0] === "events" && parts[2] === "days" && parts.length === 3) {
      const eventId = parts[1];
      findEvent(store, eventId);
      const newDay: Day = {
        id: generateId(),
        eventId,
        date: body.date ?? new Date().toISOString().slice(0, 10),
        blocks: [],
        movements: [],
      };
      store.days.push(newDay);
      saveStore(store);
      return { item: newDay } as unknown as T;
    }

    // /events/:eventId/days/:dayId/blocks
    if (parts[0] === "events" && parts[2] === "days" && parts[4] === "blocks" && parts.length === 5) {
      const eventId = parts[1];
      const dayId = parts[3];
      const day = findDay(store, dayId, eventId);
      const newBlock: Block = {
        id: generateId(),
        type: body.type,
        title: body.title ?? "Untitled",
        description: body.description ?? "",
        startTime: body.startTime ?? "09:00",
        endTime: body.endTime ?? "10:00",
        endTimeFixed: body.endTimeFixed === true, // Default to false (auto) if not explicitly true
        locationId: body.locationId,
        participantsIds: Array.isArray(body.participantsIds) ? body.participantsIds : [],
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        notes: body.notes ?? "",
        scheduleItems: Array.isArray(body.scheduleItems) ? body.scheduleItems : [],
      };
      day.blocks.push(newBlock);
      // add to participants assignment
      for (const pid of newBlock.participantsIds) {
        const p = store.participants.find((x) => x.id === pid);
        if (p) {
          if (!p.assignedBlockIds) {
            p.assignedBlockIds = [];
          }
          if (!p.assignedBlockIds.includes(newBlock.id)) {
            p.assignedBlockIds.push(newBlock.id);
          }
        }
      }
      saveStore(store);
      return { item: newBlock } as unknown as T;
    }

    // /days/:dayId/blocks/reorder (simplified - single event)
    if (parts[0] === "days" && parts[2] === "blocks" && parts[3] === "reorder") {
      const dayId = parts[1];
      const day = findDay(store, dayId);
      const order: ID[] = Array.isArray(body?.order) ? body.order : [];
      const idToBlock = new Map(day.blocks.map((b) => [b.id, b]));
      const reordered: Block[] = [];
      for (const id of order) {
        const blk = idToBlock.get(id);
        if (blk) reordered.push(blk);
      }
      // append any missing (defensive)
      for (const blk of day.blocks) {
        if (!reordered.find((b) => b.id === blk.id)) reordered.push(blk);
      }
      day.blocks = reordered;
      saveStore(store);
      return { items: day.blocks } as unknown as T;
    }

    // /events/:eventId/days/:dayId/blocks/reorder
    if (parts[0] === "events" && parts[2] === "days" && parts[4] === "blocks" && parts[5] === "reorder") {
      const eventId = parts[1];
      const dayId = parts[3];
      const day = findDay(store, dayId, eventId);
      const order: ID[] = Array.isArray(body?.order) ? body.order : [];
      const idToBlock = new Map(day.blocks.map((b) => [b.id, b]));
      const reordered: Block[] = [];
      for (const id of order) {
        const blk = idToBlock.get(id);
        if (blk) reordered.push(blk);
      }
      // append any missing (defensive)
      for (const blk of day.blocks) {
        if (!reordered.find((b) => b.id === blk.id)) reordered.push(blk);
      }
      day.blocks = reordered;
      saveStore(store);
      return { items: day.blocks } as unknown as T;
    }

    // /participants
    if (parts[0] === "participants" && parts.length === 1) {
      const newP: Participant = {
        id: generateId(),
        name: body.name ?? "Unnamed",
        roles: Array.isArray(body.roles)
          ? body.roles
          : typeof body.role === "string"
          ? [body.role]
          : [],
        email: body.email,
        phone: body.phone,
        assignedBlockIds: [],
      };
      store.participants.push(newP);
      saveStore(store);
      return { item: newP } as unknown as T;
    }

    // /locations
    if (parts[0] === "locations" && parts.length === 1) {
      const newLoc: Location = {
        id: generateId(),
        name: body.name ?? "Unnamed Location",
        address: body.address,
        googleMapsLink: body.googleMapsLink,
        type: body.type ?? "generic",
      };
      store.locations.push(newLoc);
      saveStore(store);
      return { item: newLoc } as unknown as T;
    }

    // /vehicles
    if (parts[0] === "vehicles" && parts.length === 1) {
      const newVehicle: Vehicle = {
        id: generateId(),
        label: body.label ?? "Unnamed Vehicle",
        make: body.make,
        model: body.model,
        licensePlate: body.licensePlate,
        capacity: body.capacity,
        notes: body.notes,
      };
      store.vehicles.push(newVehicle);
      saveStore(store);
      return { item: newVehicle } as unknown as T;
    }

    // /days/:dayId/movements (simplified - single event)
    if (parts[0] === "days" && parts[2] === "movements" && parts.length === 3) {
      const dayId = parts[1];
      const day = findDay(store, dayId);
      const newMovement: Movement = {
        id: generateId(),
        dayId,
        title: body.title ?? "Untitled Movement",
        description: body.description,
        fromLocationId: body.fromLocationId,
        toLocationId: body.toLocationId,
        fromTime: body.fromTime ?? "09:00",
        toTimeType: body.toTimeType ?? "fixed",
        toTime: body.toTime ?? "10:00",
        drivingTimeHours: body.drivingTimeHours,
        drivingTimeMinutes: body.drivingTimeMinutes,
        vehicleAssignments: Array.isArray(body.vehicleAssignments) ? body.vehicleAssignments : null,
        notes: body.notes,
      };
      day.movements.push(newMovement);
      saveStore(store);
      return { item: newMovement } as unknown as T;
    }

    throw new Error(`Unknown POST path: ${path}`);
  },

  async put<T = unknown>(path: string, body: any): Promise<T> {
    await sleep();
    const store = getStore();
    const parts = splitPath(path);

    // /events/:eventId
    if (parts[0] === "events" && parts.length === 2) {
      const eventId = parts[1];
      const event = findEvent(store, eventId);
      Object.assign(event, body);
      saveStore(store);
      return { item: event } as unknown as T;
    }

    // /days/:dayId (simplified - single event)
    if (parts[0] === "days" && parts.length === 2) {
      const dayId = parts[1];
      const day = findDay(store, dayId);
      if (typeof body.date === "string") {
        day.date = body.date;
      }
      if (Array.isArray(body.blocks)) {
        day.blocks = body.blocks as Block[];
      }
      saveStore(store);
      return { item: day } as unknown as T;
    }

    // /days/:dayId/blocks/:blockId (simplified - single event)
    if (parts[0] === "days" && parts[2] === "blocks" && parts.length === 4) {
      const dayId = parts[1];
      const blockId = parts[3];
      const day = findDay(store, dayId);
      const idx = day.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) throw new Error("Block not found");
      const prev = day.blocks[idx];
      const next: Block = { ...prev, ...body };

      // Update participants assignments
      const prevSet = new Set(prev.participantsIds);
      const nextSet = new Set(next.participantsIds);
      for (const p of store.participants) {
        const had = prevSet.has(p.id);
        const has = nextSet.has(p.id);
        if (had && !has) {
          if (p.assignedBlockIds) {
            p.assignedBlockIds = p.assignedBlockIds.filter((id) => id !== blockId);
          }
        } else if (!had && has) {
          if (!p.assignedBlockIds) {
            p.assignedBlockIds = [];
          }
          if (!p.assignedBlockIds.includes(blockId)) {
            p.assignedBlockIds.push(blockId);
          }
        }
      }

      day.blocks[idx] = next;
      // keep chronological by default
      day.blocks = sortBlocksChronologically(day.blocks);
      saveStore(store);
      return { item: next } as unknown as T;
    }

    // /events/:eventId/days/:dayId
    if (parts[0] === "events" && parts[2] === "days" && parts.length === 4) {
      const eventId = parts[1];
      const dayId = parts[3];
      const day = findDay(store, dayId, eventId);
      if (typeof body.date === "string") {
        day.date = body.date;
      }
      if (Array.isArray(body.blocks)) {
        day.blocks = body.blocks as Block[];
      }
      saveStore(store);
      return { item: day } as unknown as T;
    }

    // /events/:eventId/days/:dayId/blocks/:blockId
    if (parts[0] === "events" && parts[2] === "days" && parts[4] === "blocks" && parts.length === 6) {
      const eventId = parts[1];
      const dayId = parts[3];
      const blockId = parts[5];
      const day = findDay(store, dayId, eventId);
      const idx = day.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) throw new Error("Block not found");
      const prev = day.blocks[idx];
      const next: Block = { ...prev, ...body };

      // Update participants assignments
      const prevSet = new Set(prev.participantsIds);
      const nextSet = new Set(next.participantsIds);
      for (const p of store.participants) {
        const had = prevSet.has(p.id);
        const has = nextSet.has(p.id);
        if (had && !has) {
          if (p.assignedBlockIds) {
            p.assignedBlockIds = p.assignedBlockIds.filter((id) => id !== blockId);
          }
        } else if (!had && has) {
          if (!p.assignedBlockIds) {
            p.assignedBlockIds = [];
          }
          if (!p.assignedBlockIds.includes(blockId)) {
            p.assignedBlockIds.push(blockId);
          }
        }
      }

      day.blocks[idx] = next;
      // keep chronological by default
      day.blocks = sortBlocksChronologically(day.blocks);
      saveStore(store);
      return { item: next } as unknown as T;
    }

    // /participants/:id
    if (parts[0] === "participants" && parts.length === 2) {
      const id = parts[1];
      const p = store.participants.find((x) => x.id === id);
      if (!p) throw new Error("Participant not found");
      const patch = { ...body } as any;
      if (!Array.isArray(patch.roles) && typeof patch.role === "string") {
        patch.roles = [patch.role];
        delete patch.role;
      }
      Object.assign(p, patch);
      saveStore(store);
      return { item: p } as unknown as T;
    }

    // /locations/:id
    if (parts[0] === "locations" && parts.length === 2) {
      const id = parts[1];
      const loc = store.locations.find((x) => x.id === id);
      if (!loc) throw new Error("Location not found");
      Object.assign(loc, body);
      saveStore(store);
      return { item: loc } as unknown as T;
    }

    // /vehicles/:id
    if (parts[0] === "vehicles" && parts.length === 2) {
      const id = parts[1];
      const vehicle = store.vehicles.find((x) => x.id === id);
      if (!vehicle) throw new Error("Vehicle not found");
      Object.assign(vehicle, body);
      saveStore(store);
      return { item: vehicle } as unknown as T;
    }

    // /days/:dayId/movements/:movementId (simplified - single event)
    if (parts[0] === "days" && parts[2] === "movements" && parts.length === 4) {
      const dayId = parts[1];
      const movementId = parts[3];
      const day = findDay(store, dayId);
      const movement = day.movements.find((m) => m.id === movementId);
      if (!movement) throw new Error("Movement not found");
      Object.assign(movement, {
        title: body.title,
        description: body.description,
        fromLocationId: body.fromLocationId,
        toLocationId: body.toLocationId,
        fromTime: body.fromTime,
        toTimeType: body.toTimeType,
        toTime: body.toTime,
        drivingTimeHours: body.drivingTimeHours,
        drivingTimeMinutes: body.drivingTimeMinutes,
        vehicleAssignments: body.vehicleAssignments,
        notes: body.notes,
      });
      saveStore(store);
      return { item: movement } as unknown as T;
    }

    throw new Error(`Unknown PUT path: ${path}`);
  },

  async delete<T = unknown>(path: string): Promise<T> {
    await sleep();
    const store = getStore();
    const parts = splitPath(path);

    // /events/:eventId
    if (parts[0] === "events" && parts.length === 2) {
      const eventId = parts[1];
      // delete event
      store.events = store.events.filter((e) => e.id !== eventId);
      // delete related days and their blocks (cleanup participant assignments)
      const daysToDelete = store.days.filter((d) => d.eventId === eventId);
      for (const d of daysToDelete) {
        for (const b of d.blocks) {
          removeBlockIdFromParticipants(store, b.id);
        }
      }
      store.days = store.days.filter((d) => d.eventId !== eventId);
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    // /days/:dayId (simplified - single event)
    if (parts[0] === "days" && parts.length === 2) {
      const dayId = parts[1];
      const day = findDay(store, dayId);
      for (const b of day.blocks) {
        removeBlockIdFromParticipants(store, b.id);
      }
      store.days = store.days.filter((d) => d.id !== dayId);
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    // /days/:dayId/blocks/:blockId (simplified - single event)
    if (parts[0] === "days" && parts[2] === "blocks" && parts.length === 4) {
      const dayId = parts[1];
      const blockId = parts[3];
      const day = findDay(store, dayId);
      removeBlockIdFromParticipants(store, blockId);
      day.blocks = day.blocks.filter((b) => b.id !== blockId);
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    // /events/:eventId/days/:dayId
    if (parts[0] === "events" && parts[2] === "days" && parts.length === 4) {
      const eventId = parts[1];
      const dayId = parts[3];
      const day = findDay(store, dayId, eventId);
      for (const b of day.blocks) {
        removeBlockIdFromParticipants(store, b.id);
      }
      store.days = store.days.filter((d) => !(d.eventId === eventId && d.id === dayId));
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    // /events/:eventId/days/:dayId/blocks/:blockId
    if (parts[0] === "events" && parts[2] === "days" && parts[4] === "blocks" && parts.length === 6) {
      const eventId = parts[1];
      const dayId = parts[3];
      const blockId = parts[5];
      const day = findDay(store, dayId, eventId);
      removeBlockIdFromParticipants(store, blockId);
      day.blocks = day.blocks.filter((b) => b.id !== blockId);
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    // /participants/:id
    if (parts[0] === "participants" && parts.length === 2) {
      const id = parts[1];
      store.participants = store.participants.filter((x) => x.id !== id);
      removeParticipantFromBlocks(store, id);
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    // /locations/:id
    if (parts[0] === "locations" && parts.length === 2) {
      const id = parts[1];
      store.locations = store.locations.filter((x) => x.id !== id);
      removeLocationReferences(store, id);
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    // /vehicles/:id
    if (parts[0] === "vehicles" && parts.length === 2) {
      const id = parts[1];
      store.vehicles = store.vehicles.filter((x) => x.id !== id);
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    // /days/:dayId/movements/:movementId (simplified - single event)
    if (parts[0] === "days" && parts[2] === "movements" && parts.length === 4) {
      const dayId = parts[1];
      const movementId = parts[3];
      const day = findDay(store, dayId);
      day.movements = day.movements.filter((m) => m.id !== movementId);
      saveStore(store);
      return { ok: true } as unknown as T;
    }

    throw new Error(`Unknown DELETE path: ${path}`);
  },
};

export type MockApi = typeof api;
*/


