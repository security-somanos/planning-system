# Planning System API Documentation

## Base URL
All endpoints are relative to the base URL of the API server.

## Authentication

### Overview
The API uses JWT (JSON Web Tokens) for authentication. Most endpoints require authentication via a Bearer token in the Authorization header.

### Authentication Flow

1. **Login** - `POST /auth/login`
   - Request body: `{ "email": "user@example.com", "password": "password123" }`
   - Response: `{ "token": "jwt_token_string", "user": { "id": "...", "email": "...", "role": "admin|user" } }`
   - Store the token for subsequent requests

2. **Using the Token**
   - Include in all authenticated requests: `Authorization: Bearer <token>`
   - Token expires after 24 hours

### User Roles

- **admin**: Full access to all resources, can create/edit/delete users
- **user**: Can only access data where their associated participant is involved

---

## Public Endpoints

### Health Check
- **GET** `/health`
- **Authentication**: None required
- **Response**: `{ "status": "ok" }`

---

## Authentication Endpoints

### Login
- **POST** `/auth/login`
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "token": "string",
    "user": {
      "id": "uuid",
      "email": "string",
      "role": "admin|user",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
  ```
- **Error Responses**:
  - `400`: Invalid request (missing email/password)
  - `401`: Invalid credentials

---

## Admin-Only Endpoints

All endpoints in this section require:
1. Authentication (Bearer token)
2. Admin role

### User Management

#### List Users
- **GET** `/admin/users?limit=50&offset=0`
- **Query Parameters**:
  - `limit` (optional, default: 50, max: 200): Number of results per page
  - `offset` (optional, default: 0): Pagination offset
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "email": "string",
        "role": "admin|user",
        "createdAt": "ISO8601",
        "updatedAt": "ISO8601"
      }
    ],
    "total": 10
  }
  ```

#### Get User
- **GET** `/admin/users/{id}`
- **Response** (200 OK):
  ```json
  {
    "item": {
      "id": "uuid",
      "email": "string",
      "role": "admin|user",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
  ```

#### Create User
- **POST** `/admin/users`
- **Request Body**:
  ```json
  {
    "email": "string",
    "password": "string",
    "role": "admin|user"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "item": {
      "id": "uuid",
      "email": "string",
      "role": "admin|user",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
  ```
- **Error Responses**:
  - `400`: Invalid request (missing email/password, invalid role)
  - `409`: Email already exists

#### Update User
- **PUT** `/admin/users/{id}`
- **Request Body**:
  ```json
  {
    "email": "string (optional)",
    "role": "admin|user (optional)"
  }
  ```
- **Response** (200 OK): Same as Get User

#### Delete User
- **DELETE** `/admin/users/{id}`
- **Response** (204 No Content)

### Locations (Admin Only)

#### List Locations
- **GET** `/locations`
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "name": "string",
        "address": "string (optional)",
        "googleMapsLink": "string (optional)",
        "type": "string (optional)"
      }
    ],
    "total": 10
  }
  ```

#### Get Location
- **GET** `/locations/{id}`
- **Response** (200 OK):
  ```json
  {
    "item": {
      "id": "uuid",
      "name": "string",
      "address": "string (optional)",
      "googleMapsLink": "string (optional)",
      "type": "string (optional)"
    }
  }
  ```

#### Create Location
- **POST** `/locations`
- **Request Body**:
  ```json
  {
    "name": "string (required)",
    "address": "string (optional)",
    "googleMapsLink": "string (optional)",
    "type": "string (optional)"
  }
  ```
- **Response** (201 Created): Same as Get Location

#### Update Location
- **PUT** `/locations/{id}`
- **Request Body**: Same as Create Location
- **Response** (200 OK): Same as Get Location

#### Delete Location
- **DELETE** `/locations/{id}`
- **Response** (204 No Content)

### Vehicles (Admin Only)

#### List Vehicles
- **GET** `/vehicles`
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "label": "string",
        "make": "string (optional)",
        "model": "string (optional)",
        "licensePlate": "string (optional)",
        "capacity": 0,
        "notes": "string (optional)",
        "availableFrom": "HH:mm (optional)",
        "availableTo": "HH:mm (optional)",
        "originationLocationId": "uuid (optional)"
      }
    ],
    "total": 10
  }
  ```

#### Get Vehicle
- **GET** `/vehicles/{id}`
- **Response** (200 OK):
  ```json
  {
    "item": {
      "id": "uuid",
      "label": "string",
      "make": "string (optional)",
      "model": "string (optional)",
      "licensePlate": "string (optional)",
      "capacity": 0,
      "notes": "string (optional)",
      "availableFrom": "HH:mm (optional)",
      "availableTo": "HH:mm (optional)",
      "originationLocationId": "uuid (optional)"
    }
  }
  ```

#### Create Vehicle
- **POST** `/vehicles`
- **Request Body**:
  ```json
  {
    "label": "string (required)",
    "make": "string (optional)",
    "model": "string (optional)",
    "licensePlate": "string (optional)",
    "capacity": 0,
    "notes": "string (optional)",
    "availableFrom": "HH:mm (optional)",
    "availableTo": "HH:mm (optional)",
    "originationLocationId": "uuid (optional)"
  }
  ```
- **Response** (201 Created): Same as Get Vehicle

#### Update Vehicle
- **PUT** `/vehicles/{id}`
- **Request Body**: Same as Create Vehicle
- **Response** (200 OK): Same as Get Vehicle

#### Delete Vehicle
- **DELETE** `/vehicles/{id}`
- **Response** (204 No Content)

### Participants (Admin Only)

#### List Participants
- **GET** `/participants?limit=50&offset=0&search=query&role=role`
- **Query Parameters**:
  - `limit` (optional, default: 50, max: 200)
  - `offset` (optional, default: 0)
  - `search` (optional): Search in name, email, phone
  - `role` (optional): Filter by participant role
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "name": "string",
        "roles": ["string"],
        "email": "string (optional)",
        "phone": "string (optional)",
        "languages": ["string"],
        "userId": "uuid (optional)"
      }
    ],
    "total": 10
  }
  ```

#### Get Participant
- **GET** `/participants/{id}`
- **Response** (200 OK):
  ```json
  {
    "item": {
      "id": "uuid",
      "name": "string",
      "roles": ["string"],
      "email": "string (optional)",
      "phone": "string (optional)",
      "languages": ["string"],
      "userId": "uuid (optional)"
    }
  }
  ```

#### Create Participant
- **POST** `/participants`
- **Request Body**:
  ```json
  {
    "name": "string (required)",
    "roles": ["string"],
    "email": "string (optional)",
    "phone": "string (optional)",
    "languages": ["string"],
    "userId": "uuid (optional)"
  }
  ```
- **Response** (201 Created): Same as Get Participant

#### Update Participant
- **PUT** `/participants/{id}`
- **Request Body**: Same as Create Participant
- **Response** (200 OK): Same as Get Participant

#### Delete Participant
- **DELETE** `/participants/{id}`
- **Response** (204 No Content)

---

## Authenticated Endpoints (Admin + Regular Users)

### Days

#### List Days
- **GET** `/days`
- **Authentication**: Required
- **Access Control**:
  - Admin: All days
  - User: Only days where their participant is involved
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "eventId": "uuid",
        "date": "YYYY-MM-DD",
        "blocks": [],
        "movements": []
      }
    ],
    "total": 10
  }
  ```

#### Get Day
- **GET** `/days/{dayId}`
- **Authentication**: Required
- **Access Control**:
  - Admin: Any day
  - User: Only if their participant is involved
- **Response** (200 OK):
  ```json
  {
    "item": {
      "id": "uuid",
      "eventId": "uuid",
      "date": "YYYY-MM-DD",
      "blocks": [
        {
          "id": "uuid",
          "type": "activity|break",
          "title": "string",
          "description": "string (optional)",
          "startTime": "HH:mm",
          "endTime": "HH:mm (optional)",
          "endTimeFixed": true,
          "locationId": "uuid (optional)",
          "participantsIds": ["uuid"],
          "advanceParticipantIds": ["uuid"],
          "metByParticipantIds": ["uuid"],
          "attachments": [],
          "notes": "string (optional)",
          "scheduleItems": [
            {
              "id": "uuid",
              "time": "HH:mm",
              "description": "string",
              "staffInstructions": "string (optional)",
              "guestInstructions": "string (optional)",
              "notes": "string (optional)"
            }
          ]
        }
      ],
      "movements": []
    }
  }
  ```

#### Create Days (Admin Only)
- **POST** `/days`
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "dates": ["YYYY-MM-DD", "YYYY-MM-DD"]
  }
  ```
- **Response** (201 Created): List of created days

#### Delete Day (Admin Only)
- **DELETE** `/days/{dayId}`
- **Authentication**: Required (Admin only)
- **Response** (204 No Content)

### Blocks

#### List Blocks
- **GET** `/days/{dayId}/blocks`
- **Authentication**: Required
- **Access Control**:
  - Admin: Any day's blocks
  - User: Only if their participant is involved in the day
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "type": "activity|break",
        "title": "string",
        "description": "string (optional)",
        "startTime": "HH:mm",
        "endTime": "HH:mm (optional)",
        "endTimeFixed": true,
        "locationId": "uuid (optional)",
        "participantsIds": ["uuid"],
        "advanceParticipantIds": ["uuid"],
        "metByParticipantIds": ["uuid"],
        "attachments": [],
        "notes": "string (optional)",
        "scheduleItems": []
      }
    ],
    "total": 10
  }
  ```

#### Get Block
- **GET** `/days/{dayId}/blocks/{blockId}`
- **Authentication**: Required
- **Access Control**: Same as List Blocks
- **Response** (200 OK): Single block object

#### Create Block (Admin Only)
- **POST** `/days/{dayId}/blocks`
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "type": "activity|break (required)",
    "title": "string (required)",
    "description": "string (optional)",
    "startTime": "HH:mm (required)",
    "endTime": "HH:mm (optional)",
    "endTimeFixed": true,
    "locationId": "uuid (optional)",
    "participantsIds": ["uuid"],
    "advanceParticipantIds": ["uuid"],
    "metByParticipantIds": ["uuid"],
    "attachments": [],
    "notes": "string (optional)",
    "scheduleItems": []
  }
  ```
- **Response** (201 Created): Created block object

#### Update Block (Admin Only)
- **PUT** `/days/{dayId}/blocks/{blockId}`
- **Authentication**: Required (Admin only)
- **Request Body**: Same as Create Block
- **Response** (200 OK): Updated block object

#### Delete Block (Admin Only)
- **DELETE** `/days/{dayId}/blocks/{blockId}`
- **Authentication**: Required (Admin only)
- **Response** (204 No Content)

### Movements

#### List Movements
- **GET** `/days/{dayId}/movements`
- **Authentication**: Required
- **Access Control**:
  - Admin: Any day's movements
  - User: Only if their participant is involved in the day
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "title": "string",
        "description": "string (optional)",
        "fromLocationId": "uuid",
        "toLocationId": "uuid",
        "fromTime": "HH:mm",
        "toTimeType": "fixed|driving",
        "toTime": "HH:mm (if fixed) or minutes as string (if driving)",
        "drivingTimeHours": 0,
        "drivingTimeMinutes": 0,
        "vehicleAssignments": [
          {
            "vehicleId": "uuid",
            "driverId": "uuid (optional)",
            "participantIds": ["uuid"]
          }
        ],
        "notes": "string (optional)"
      }
    ],
    "total": 10
  }
  ```

#### Get Movement
- **GET** `/days/{dayId}/movements/{movementId}`
- **Authentication**: Required
- **Access Control**: Same as List Movements
- **Response** (200 OK): Single movement object

#### Create Movement (Admin Only)
- **POST** `/days/{dayId}/movements`
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "title": "string (required)",
    "description": "string (optional)",
    "fromLocationId": "uuid (required)",
    "toLocationId": "uuid (required)",
    "fromTime": "HH:mm (required)",
    "toTimeType": "fixed|driving (required)",
    "toTime": "HH:mm (if fixed) or minutes as string (if driving)",
    "drivingTimeHours": 0,
    "drivingTimeMinutes": 0,
    "vehicleAssignments": [],
    "notes": "string (optional)"
  }
  ```
- **Response** (201 Created): Created movement object

#### Update Movement (Admin Only)
- **PUT** `/days/{dayId}/movements/{movementId}`
- **Authentication**: Required (Admin only)
- **Request Body**: Same as Create Movement
- **Response** (200 OK): Updated movement object

#### Delete Movement (Admin Only)
- **DELETE** `/days/{dayId}/movements/{movementId}`
- **Authentication**: Required (Admin only)
- **Response** (204 No Content)

### Itinerary

#### Get Itinerary
- **GET** `/itinerary`
- **Authentication**: Required
- **Access Control**:
  - Admin: All days
  - User: Only days where their participant is involved
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "day": {
          "id": "uuid",
          "eventId": "uuid",
          "date": "YYYY-MM-DD",
          "blocks": [],
          "movements": []
        },
        "blocks": [],
        "movements": []
      }
    ],
    "total": 10
  }
  ```

### Agenda

#### Get Participant Agenda
- **GET** `/agenda/{participantId}`
- **Authentication**: Required
- **Access Control**:
  - Admin: Any participant's agenda
  - User: Only their own participant's agenda
- **Response** (200 OK):
  ```json
  {
    "items": [
      {
        "day_id": "uuid",
        "date": "YYYY-MM-DD",
        "block": {
          "id": "uuid",
          "type": "activity|break",
          "title": "string",
          "description": "string (optional)",
          "startTime": "HH:mm",
          "endTime": "HH:mm (optional)",
          "endTimeFixed": true,
          "locationId": "uuid (optional)",
          "participantsIds": ["uuid"],
          "advanceParticipantIds": ["uuid"],
          "metByParticipantIds": ["uuid"],
          "attachments": [],
          "notes": "string (optional)",
          "scheduleItems": []
        }
      }
    ],
    "total": 10
  }
  ```

### PDF Export

#### Export PDF
- **GET** `/export/pdf`
- **Authentication**: Required
- **Access Control**:
  - Admin: All days
  - User: Only days where their participant is involved
- **Response**: PDF file (Content-Type: application/pdf)
- **Headers**: 
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="event-plan.pdf"`

---

## Data Structures

### User
```typescript
interface User {
  id: string;              // UUID
  email: string;
  role: "admin" | "user";
  createdAt?: string;      // ISO8601 timestamp
  updatedAt?: string;      // ISO8601 timestamp
}
```

### Participant
```typescript
interface Participant {
  id: string;              // UUID
  name: string;
  roles: string[];         // Array of role strings
  email?: string;
  phone?: string;
  languages: string[];      // Array of language codes
  userId?: string;         // UUID - Links to User
  assignedBlockIds?: string[];  // Derived field, not in create/update
}
```

### Location
```typescript
interface Location {
  id: string;              // UUID
  name: string;
  address?: string;
  googleMapsLink?: string;
  type?: string;
}
```

### Vehicle
```typescript
interface Vehicle {
  id: string;              // UUID
  label: string;
  make?: string;
  model?: string;
  licensePlate?: string;
  capacity: number;        // Integer, default 0
  notes?: string;
  availableFrom?: string;  // HH:mm format
  availableTo?: string;    // HH:mm format
  originationLocationId?: string;  // UUID
}
```

### Day
```typescript
interface Day {
  id: string;              // UUID
  eventId: string;         // UUID
  date: string;            // YYYY-MM-DD format
  blocks: Block[];         // Ordered array
  movements: Movement[];   // Ordered array
}
```

### Block
```typescript
interface Block {
  id: string;              // UUID
  type: "activity" | "break";
  title: string;
  description?: string;
  startTime: string;       // HH:mm format
  endTime?: string;        // HH:mm format
  endTimeFixed?: boolean;
  locationId?: string;     // UUID
  participantsIds: string[];  // Array of participant UUIDs
  advanceParticipantIds: string[];  // Array of participant UUIDs
  metByParticipantIds: string[];     // Array of participant UUIDs
  attachments: string[];   // Array of attachment identifiers
  notes?: string;
  scheduleItems: ScheduleItem[];  // Ordered by time
}
```

### ScheduleItem
```typescript
interface ScheduleItem {
  id: string;              // UUID
  time: string;            // HH:mm format
  description: string;
  staffInstructions?: string;
  guestInstructions?: string;
  notes?: string;
}
```

### Movement
```typescript
interface Movement {
  id: string;              // UUID
  title: string;
  description?: string;
  fromLocationId: string; // UUID
  toLocationId: string;   // UUID
  fromTime: string;       // HH:mm format
  toTimeType: "fixed" | "driving";
  toTime: string;         // HH:mm if fixed, or minutes as string if driving
  drivingTimeHours?: number;
  drivingTimeMinutes?: number;
  vehicleAssignments: VehicleAssignment[];
  notes?: string;
}
```

### VehicleAssignment
```typescript
interface VehicleAssignment {
  vehicleId: string;       // UUID
  driverId?: string;       // UUID - Participant ID
  participantIds: string[]; // Array of participant UUIDs (passengers)
}
```

### ItineraryDay
```typescript
interface ItineraryDay {
  day: Day;
  blocks: Block[];
  movements: Movement[];
}
```

### AgendaItem
```typescript
interface AgendaItem {
  day_id: string;         // UUID
  date: string;           // YYYY-MM-DD format
  block: Block;
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "error message string"
}
```

### HTTP Status Codes

- **200 OK**: Successful GET, PUT request
- **201 Created**: Successful POST request
- **204 No Content**: Successful DELETE request
- **400 Bad Request**: Invalid request body or parameters
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Authenticated but insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate email)
- **500 Internal Server Error**: Server error

---

## Pagination

List endpoints support pagination via query parameters:

- `limit`: Number of items per page (default: 50, max: 200)
- `offset`: Number of items to skip (default: 0)

Response includes `total` field with the total count of items.

---

## Involvement Rules

For regular users (non-admin), access is restricted to data where their associated participant is involved:

1. **Day Access**: User can access a day if their participant is:
   - Assigned to any block in that day (as participant, advance, or met-by)
   - Driver or passenger in any movement in that day

2. **Block Access**: Inherited from day access (if user can access the day, they can access its blocks)

3. **Movement Access**: Inherited from day access (if user can access the day, they can access its movements)

4. **Agenda Access**: User can only access agenda for their own participant (where `participant.userId === user.id`)

5. **PDF Export**: Only exports days where the user is involved

---

## Example Integration Flow

### 1. Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "role": "user"
  }
}
```

### 2. Authenticated Request
```http
GET /days
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Create Resource (Admin Only)
```http
POST /locations
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Hotel Grand",
  "address": "123 Main St",
  "googleMapsLink": "https://maps.google.com/...",
  "type": "hotel"
}
```

---

## Notes

- All UUIDs are in standard UUID format
- Date strings use ISO 8601 format (YYYY-MM-DD)
- Time strings use 24-hour format (HH:mm)
- Arrays are always returned, never null (empty array `[]` if no items)
- Optional fields may be omitted from request/response
- Password fields are never returned in responses
- The `userId` field in Participant links a participant to a user account

