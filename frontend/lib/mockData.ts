import { Block, Day, Event, Location, Movement, Participant, ScheduleItem, Store, Vehicle } from "./types";
import { generateId } from "./id";

function id(prefix: string) {
  return `${prefix}-${generateId()}`;
}

// Static seeds so app looks populated on first run
const eventId = "event-1";
const locVenueId = "loc-venue";
const locHotelId = "loc-hotel";
const locRestaurantId = "loc-restaurant";
const locAirportId = "loc-airport";

const p1Id = "p1";
const p2Id = "p2";
const p3Id = "p3";

const events: Event[] = [
  {
    id: eventId,
    name: "Global Summit 2025",
    description: "International multi-day conference for leaders and partners.",
    startDate: "2025-03-10",
    endDate: "2025-03-12",
  },
];

const locations: Location[] = [
  {
    id: locVenueId,
    name: "İstanbul Üniversitesi",
    address: "Karaağaç, İstanbul Üniversitesi Merkez Kampüsü, 34500 Beyazıt/Büyükçekmece/İstanbul, Turquía",
    type: "venue",
    googleMapsLink: "https://maps.app.goo.gl/HrZ5GAfDcykZDQU19",
  },
  {
    id: locHotelId,
    name: "Grand Hotel",
    address: "456 Luxury Ave, City",
    type: "hotel",
    googleMapsLink: "https://maps.google.com/?q=Grand+Hotel",
  },
  {
    id: locRestaurantId,
    name: "Sea Breeze Restaurant",
    address: "789 Ocean Dr, City",
    type: "restaurant",
    googleMapsLink: "https://maps.google.com/?q=Sea+Breeze+Restaurant",
  },
  {
    id: locAirportId,
    name: "Aeropuerto de Estambul",
    address: "Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Turquía",
    type: "generic",
    googleMapsLink: "https://maps.app.goo.gl/Fpeygpd1w1uusbXp6",
  },
];

// Create blocks for two days
const day1Blocks: Block[] = [
  {
    id: "b1",
    type: "activity",
    title: "Registration",
    description: "Check-in and badge pickup.",
    startTime: "09:00",
    endTime: "10:00",
    locationId: locVenueId,
    participantsIds: [p1Id, p2Id, p3Id],
    attachments: ["welcome.pdf"],
    scheduleItems: [],
    endTimeFixed: true,
  },
  {
    id: "b2",
    type: "break",
    title: "Coffee Break",
    description: "Light refreshments.",
    startTime: "10:00",
    endTime: "10:30",
    locationId: locVenueId,
    participantsIds: [p1Id, p2Id, p3Id],
    attachments: [],
    scheduleItems: [],
    endTimeFixed: true,
  },
  {
    id: "b3",
    type: "activity",
    title: "Opening Keynote",
    description: "Keynote by event chair.",
    startTime: "10:30",
    endTime: "12:00",
    locationId: locVenueId,
    participantsIds: [p1Id, p2Id],
    attachments: ["keynote-agenda.pdf"],
    scheduleItems: [],
    endTimeFixed: true,
  },
  {
    id: "b5",
    type: "activity",
    title: "Lunch",
    description: "Group lunch.",
    startTime: "13:00",
    endTime: "14:30",
    locationId: locRestaurantId,
    participantsIds: [p1Id, p2Id, p3Id],
    attachments: [],
    scheduleItems: [],
    endTimeFixed: true,
  },
];

const day2Blocks: Block[] = [
  {
    id: "b6",
    type: "activity",
    title: "Workshops",
    description: "Breakout sessions.",
    startTime: "09:00",
    endTime: "11:00",
    locationId: locVenueId,
    participantsIds: [p1Id, p3Id],
    attachments: [],
    scheduleItems: [],
    endTimeFixed: true,
  },
  {
    id: "b7",
    type: "break",
    title: "Short Break",
    description: "Refreshments.",
    startTime: "11:00",
    endTime: "11:15",
    locationId: locVenueId,
    participantsIds: [p1Id, p2Id, p3Id],
    attachments: [],
    scheduleItems: [],
    endTimeFixed: true,
  },
  {
    id: "b9",
    type: "activity",
    title: "Press Briefing",
    description: "Media Q&A.",
    startTime: "12:30",
    endTime: "13:30",
    locationId: locVenueId,
    participantsIds: [p2Id],
    attachments: [],
    scheduleItems: [],
    endTimeFixed: true,
  },
];

const day1Movements: Movement[] = [
  {
    id: "m1",
    dayId: "day1",
    title: "Transfer to Hotel",
    description: "Shuttle buses from venue to hotel.",
    fromLocationId: locVenueId,
    toLocationId: locHotelId,
    fromTime: "12:00",
    toTimeType: "fixed",
    toTime: "12:45",
    vehicleAssignments: [
      {
        vehicleId: "v3",
        driverId: p3Id,
        participantIds: [p1Id],
      },
    ],
  },
];

const day2Movements: Movement[] = [
  {
    id: "m2",
    dayId: "day2",
    title: "Transfer to Airport",
    description: "Shuttle for press to airport.",
    fromLocationId: locVenueId,
    toLocationId: locAirportId,
    fromTime: "11:30",
    toTimeType: "driving",
    toTime: "30", // 30 minutes
    drivingTimeHours: 0,
    drivingTimeMinutes: 30,
    vehicleAssignments: [
      {
        vehicleId: "v2",
        driverId: p3Id,
        participantIds: [p2Id],
      },
    ],
  },
];

const days: Day[] = [
  {
    id: "day1",
    eventId,
    date: "2025-03-10",
    blocks: day1Blocks,
    movements: day1Movements,
  },
  {
    id: "day2",
    eventId,
    date: "2025-03-11",
    blocks: day2Blocks,
    movements: day2Movements,
  },
];

const participants: Participant[] = [
  {
    id: p1Id,
    name: "Alice Johnson",
    roles: ["VIP"],
    email: "alice@example.com",
    phone: "+1234567890",
    languages: ["English", "French"],
    assignedBlockIds: ["b1", "b2", "b3", "b5", "b6", "b7"],
    isPasswordSet: false,
  },
  {
    id: p2Id,
    name: "Bob Lee",
    roles: ["press"],
    email: "bob@example.com",
    phone: "+1987654321",
    languages: ["English", "Spanish", "Chinese (Mandarin)"],
    assignedBlockIds: ["b1", "b2", "b3", "b5", "b7", "b9"],
    isPasswordSet: false,
  },
  {
    id: p3Id,
    name: "Carol Smith",
    roles: ["staff"],
    email: "carol@example.com",
    phone: "+1098765432",
    languages: ["English", "Turkish"],
    assignedBlockIds: ["b1", "b2", "b5", "b6", "b7"],
    isPasswordSet: false,
  },
];

const vehicles: Vehicle[] = [
  {
    id: "v1",
    label: "Car 1",
    make: "Toyota",
    model: "Camry",
    licensePlate: "ABC-123",
    capacity: 5,
    availableFrom: "08:00",
    availableTo: "20:00",
    originationLocationId: locVenueId,
    notes: "VIP transport",
  },
  {
    id: "v2",
    label: "Van A",
    make: "Mercedes",
    model: "Sprinter",
    licensePlate: "XYZ-789",
    capacity: 12,
    availableFrom: "07:00",
    availableTo: "22:00",
    originationLocationId: locHotelId,
    notes: "Group transport",
  },
  {
    id: "v3",
    label: "Bus 1",
    make: "Volvo",
    model: "9700",
    licensePlate: "BUS-001",
    capacity: 50,
    availableFrom: "06:00",
    availableTo: "23:00",
    originationLocationId: locAirportId,
    notes: "Main shuttle",
  },
  {
    id: "v4",
    label: "Car 2",
    make: "BMW",
    model: "5 Series",
    licensePlate: "DEF-456",
    capacity: 5,
    availableFrom: "09:00",
    availableTo: "18:00",
    originationLocationId: locVenueId,
  },
];

export function buildSeedStore(): Store {
  return {
    version: 1,
    events: [...events],
    days: [...days],
    participants: [...participants],
    locations: [...locations],
    vehicles: [...vehicles],
  };
}


