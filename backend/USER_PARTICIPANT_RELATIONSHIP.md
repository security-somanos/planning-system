# User-Participant Relationship & Involvement System

## Overview

The system uses a **one-to-one relationship** between Users and Participants to determine what data a user can access. A user can only see events/days where their associated participant is involved.

---

## 1. How to Relate a User to a Participant

### Database Structure

The `participants` table has a `user_id` column (nullable UUID) that references the `users` table:

```sql
ALTER TABLE participants
ADD COLUMN user_id UUID;

ALTER TABLE participants
ADD CONSTRAINT fk_participants_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
```

### Relationship Type

- **One-to-One**: One user can have one participant
- **Optional**: A participant can exist without a user (for staff/guests who don't have accounts)
- **Nullable**: The `user_id` field is optional

### How to Link Them

#### Option 1: When Creating a Participant (Admin Only)

When an admin creates a participant via `POST /participants`, they can include the `userId`:

```json
POST /participants
{
  "name": "John Doe",
  "roles": ["guest"],
  "email": "john@example.com",
  "phone": "+1234567890",
  "languages": ["en"],
  "userId": "123e4567-e89b-12d3-a456-426614174000"  // ← Link to user
}
```

#### Option 2: When Updating a Participant (Admin Only)

An admin can update an existing participant to link it to a user:

```json
PUT /participants/{participantId}
{
  "name": "John Doe",
  "roles": ["guest"],
  "email": "john@example.com",
  "phone": "+1234567890",
  "languages": ["en"],
  "userId": "123e4567-e89b-12d3-a456-426614174000"  // ← Add user link
}
```

#### Option 3: When Creating a User (Admin Only)

1. Create the user first: `POST /admin/users`
2. Then create/update a participant with that user's ID: `POST /participants` or `PUT /participants/{id}`

---

## 2. How the System Determines Which Days/Events to Show

### The Flow

When a regular user (non-admin) requests data, the system:

1. **Gets the authenticated user** from the JWT token
2. **Finds the participant** where `participant.user_id = user.id`
3. **Checks involvement** - Is this participant referenced in any blocks or movements?
4. **Filters results** - Only returns days where the participant is involved

### Involvement Check Logic

The system checks if a user's participant is involved in a day by looking for:

#### A. Block Involvement

A participant is involved in a block if they appear in:
- `block_participants` - Regular participants in the block
- `block_advance_participants` - Participants who arrive early
- `block_met_by_participants` - Participants who meet others

**SQL Query** (from `IsUserInvolvedInDay`):
```sql
SELECT COUNT(*)
FROM participants p
WHERE p.user_id = $1  -- The user's ID
AND (
  -- Participant in blocks
  EXISTS (
    SELECT 1 FROM blocks b
    JOIN block_participants bp ON bp.block_id = b.id
    WHERE b.day_id = $2 AND bp.participant_id = p.id
  )
  OR EXISTS (
    SELECT 1 FROM blocks b
    JOIN block_advance_participants bp ON bp.block_id = b.id
    WHERE b.day_id = $2 AND bp.participant_id = p.id
  )
  OR EXISTS (
    SELECT 1 FROM blocks b
    JOIN block_met_by_participants bp ON bp.block_id = b.id
    WHERE b.day_id = $2 AND bp.participant_id = p.id
  )
  -- ... movement checks below
)
```

#### B. Movement Involvement

A participant is involved in a movement if they are:
- **Driver**: `vehicle_assignments.driver_id = participant.id`
- **Passenger**: Listed in `vehicle_assignment_passengers` for that movement

**SQL Query** (continued):
```sql
  -- Participant in movements (as driver or passenger)
  OR EXISTS (
    SELECT 1 FROM movements m
    JOIN vehicle_assignments va ON va.movement_id = m.id
    WHERE m.day_id = $2 AND va.driver_id = p.id
  )
  OR EXISTS (
    SELECT 1 FROM movements m
    JOIN vehicle_assignments va ON va.movement_id = m.id
    JOIN vehicle_assignment_passengers vap ON vap.assignment_id = va.id
    WHERE m.day_id = $2 AND vap.participant_id = p.id
  )
)
```

### Example Scenario

Let's say:
- **User**: `user-123` (email: `john@example.com`)
- **Participant**: `participant-456` (name: "John Doe", `user_id = user-123`)

**Day 1** has:
- Block A with `participant-456` in `block_participants`
- Movement X with `participant-456` as driver

**Day 2** has:
- Block B with `participant-789` (different participant)
- No movements involving `participant-456`

**Result**:
- User `user-123` can see **Day 1** (their participant is involved)
- User `user-123` **cannot** see **Day 2** (their participant is not involved)

---

## 3. Code Flow Example

### When User Requests Days: `GET /days`

```go
// 1. Get authenticated user from JWT token
user, ok := auth.GetUserFromContext(r)  // user.ID = "user-123"

// 2. If admin, return all days
if user.Role == "admin" {
    return allDays
}

// 3. If regular user, filter by involvement
for each day in allDays {
    // Check if user's participant is involved
    involved, err := h.sv.Involvement.IsUserInvolvedInDay(
        ctx, 
        user.ID,      // "user-123"
        day.ID        // "day-1"
    )
    
    // The query inside checks:
    // - Find participant where user_id = "user-123"
    // - Check if that participant is in any blocks/movements of day-1
    
    if involved {
        add day to filtered list
    }
}

return filtered list
```

### The Involvement Check Query Breakdown

```sql
-- Step 1: Find the participant linked to this user
FROM participants p
WHERE p.user_id = 'user-123'  -- Finds participant-456

-- Step 2: Check if participant-456 is in any blocks of this day
EXISTS (
    SELECT 1 FROM blocks b
    JOIN block_participants bp ON bp.block_id = b.id
    WHERE b.day_id = 'day-1' 
    AND bp.participant_id = 'participant-456'  -- Found! User is involved
)

-- OR check movements...
```

---

## 4. Important Points

### ✅ What Works

1. **One user → One participant**: Each user can be linked to exactly one participant
2. **Optional linking**: Participants can exist without users (for staff who don't need accounts)
3. **Automatic filtering**: Regular users automatically only see days where their participant is involved
4. **Admin bypass**: Admins see everything regardless of involvement

### ⚠️ Limitations

1. **No multiple participants per user**: A user cannot be linked to multiple participants
2. **No user = no access**: If a participant has no `user_id`, that participant's data won't be accessible to any user account
3. **Manual linking required**: Admins must manually link users to participants when creating/updating participants

### 🔒 Security

- Regular users can **only** see days where their participant is involved
- Regular users **cannot** see other participants' data
- Regular users **cannot** see days where they're not involved
- Admin users bypass all these restrictions

---

## 5. Typical Workflow

### Setting Up a New User

1. **Admin creates user**: `POST /admin/users`
   ```json
   {
     "email": "john@example.com",
     "password": "secure123",
     "role": "user"
   }
   ```
   Response: `{ "id": "user-123", ... }`

2. **Admin creates participant**: `POST /participants`
   ```json
   {
     "name": "John Doe",
     "roles": ["guest"],
     "email": "john@example.com",
     "userId": "user-123"  // ← Link them
   }
   ```
   Response: `{ "id": "participant-456", "userId": "user-123", ... }`

3. **Admin assigns participant to blocks/movements**: When creating blocks or movements, include `participant-456` in:
   - `participantsIds`
   - `advanceParticipantIds`
   - `metByParticipantIds`
   - Or as driver/passenger in movements

4. **User logs in**: `POST /auth/login` with `john@example.com` / `secure123`

5. **User requests days**: `GET /days` → Only sees days where `participant-456` is involved

---

## 6. Database Schema Summary

```
users
├── id (UUID, PK)
├── email
├── password_hash
└── role

participants
├── id (UUID, PK)
├── name
├── roles
├── email
├── phone
├── languages
└── user_id (UUID, FK → users.id, nullable)  ← The link!

blocks
├── id
└── day_id

block_participants
├── block_id (FK → blocks.id)
└── participant_id (FK → participants.id)  ← Involvement check

movements
├── id
└── day_id

vehicle_assignments
├── id
├── movement_id (FK → movements.id)
└── driver_id (FK → participants.id)  ← Involvement check

vehicle_assignment_passengers
├── assignment_id (FK → vehicle_assignments.id)
└── participant_id (FK → participants.id)  ← Involvement check
```

---

## Summary

- **Link user to participant**: Set `userId` when creating/updating a participant
- **Determine access**: System finds participant where `user_id = user.id`, then checks if that participant is in blocks/movements
- **Filter days**: Only days where the participant is involved are returned to regular users
- **Admin bypass**: Admins see everything

The key is: **User → Participant → Blocks/Movements → Days**

