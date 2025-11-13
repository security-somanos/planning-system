# Frontend Update Guide: Participant-User Integration

## Overview
The backend has been updated so that participants can now have user accounts. When creating a participant, admins can optionally set a password and enable login. Each participant with a user account can log in to the system.

## Key Changes

### 1. Participant Model Updates
The `Participant` type now includes:
- `isPasswordSet: boolean` - Indicates if the participant has a password set (read-only)
- `isUserEnabled: boolean | null` - Indicates if the user account is enabled for login (null if no user account exists)

### 2. Create Participant Request
When creating a participant, you can now include:
```typescript
{
  name: string;
  roles: string[];
  email?: string;
  phone?: string;
  languages?: string[];
  password?: string;        // NEW: If provided, creates a user account
  isUserEnabled?: boolean; // NEW: Enables login (defaults to false)
}
```

**Important:**
- If `password` is provided, `email` is **required**
- If `password` is provided but `isUserEnabled` is not, it defaults to `false`
- Creating a participant with a password automatically creates a user account

### 3. Update Participant Request
When updating a participant, you can now:
```typescript
{
  name?: string;
  roles?: string[];
  email?: string;
  phone?: string;
  languages?: string[];
  password?: string;        // NEW: Updates/creates password
  isUserEnabled?: boolean; // NEW: Enables/disables login
}
```

**Important:**
- If updating a participant that doesn't have a user account yet, providing `password` or `isUserEnabled` will create one (email required)
- If updating password, the old password is replaced
- You can enable/disable login without changing the password

### 4. Removed Route
- `POST /admin/users` - This route has been removed. Users are now created automatically when creating participants with a password.

## Frontend Implementation Steps

### Step 1: Update Participant Type Definition
Update your `Participant` type in `lib/types.ts`:

```typescript
export interface Participant {
  id: ID;
  name: string;
  roles: string[];
  email?: string;
  phone?: string;
  languages?: string[];
  userId?: ID;
  assignedBlockIds?: ID[];
  isPasswordSet: boolean;      // NEW
  isUserEnabled?: boolean | null; // NEW
}
```

### Step 2: Update Create Participant Form
In your participant creation form (e.g., `app/(admin)/admin/participants/page.tsx`):

1. Add a password input field:
```tsx
<Input
  type="password"
  label="Password (optional)"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  placeholder="Leave empty to create participant without login"
/>
```

2. Add a checkbox for enabling login:
```tsx
<label>
  <input
    type="checkbox"
    checked={isUserEnabled}
    onChange={(e) => setIsUserEnabled(e.target.checked)}
  />
  Enable login for this participant
</label>
```

3. Update the create request:
```typescript
const createParticipant = async () => {
  const payload: any = {
    name,
    roles,
    email,
    phone,
    languages,
  };
  
  // Only include password and isUserEnabled if password is provided
  if (password) {
    payload.password = password;
    payload.isUserEnabled = isUserEnabled;
  }
  
  await api.post('/participants', payload);
};
```

**Validation:**
- If password is provided, email must be provided
- Show validation error: "Email is required when creating a user account"

### Step 3: Update Participant List/Table
In your participants list view, add columns to show user account status:

```tsx
// Add columns to show:
// - Password status (isPasswordSet)
// - Login enabled status (isUserEnabled)

{participants.map(p => (
  <tr key={p.id}>
    {/* existing columns */}
    <td>
      {p.isPasswordSet ? (
        <span className="text-green-600">✓ Password set</span>
      ) : (
        <span className="text-gray-400">No password</span>
      )}
    </td>
    <td>
      {p.isUserEnabled === true ? (
        <span className="text-green-600">✓ Enabled</span>
      ) : p.isUserEnabled === false ? (
        <span className="text-red-600">✗ Disabled</span>
      ) : (
        <span className="text-gray-400">No account</span>
      )}
    </td>
  </tr>
))}
```

### Step 4: Update Participant Edit Form
In your participant edit form:

1. Add password update field (only show if user account exists):
```tsx
{participant.userId && (
  <div>
    <Input
      type="password"
      label="New Password (optional)"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      placeholder="Leave empty to keep current password"
    />
  </div>
)}
```

2. Add login enabled checkbox:
```tsx
{participant.userId && (
  <label>
    <input
      type="checkbox"
      checked={isUserEnabled ?? false}
      onChange={(e) => setIsUserEnabled(e.target.checked)}
    />
    Enable login for this participant
  </label>
)}
```

3. Update the update request:
```typescript
const updateParticipant = async () => {
  const payload: any = {
    name,
    roles,
    email,
    phone,
    languages,
  };
  
  // Only include password if it's being changed
  if (newPassword) {
    payload.password = newPassword;
  }
  
  // Include isUserEnabled if user account exists
  if (participant.userId && isUserEnabled !== undefined) {
    payload.isUserEnabled = isUserEnabled;
  }
  
  await api.put(`/participants/${participant.id}`, payload);
};
```

**Special Cases:**
- If participant doesn't have a user account yet, you can create one by providing both `password` and `email`
- If creating a user account during update, `password` is required

### Step 5: Update Login Validation
The backend now checks both:
1. Password is correct
2. `isUserEnabled` is `true`

If login fails with "user account is disabled", show a user-friendly message:
```tsx
if (error.message.includes('disabled')) {
  setError('Your account has been disabled. Please contact an administrator.');
} else {
  setError('Invalid email or password');
}
```

### Step 6: Remove Create User UI
Remove any UI components that call `POST /admin/users` since this route no longer exists. Users are now created through the participant creation flow.

## Example: Complete Create Participant Form

```tsx
'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function CreateParticipantForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isUserEnabled, setIsUserEnabled] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password && !email) {
      setError('Email is required when creating a user account');
      return;
    }

    try {
      const payload: any = {
        name,
        email,
        roles: [],
      };

      if (password) {
        payload.password = password;
        payload.isUserEnabled = isUserEnabled;
      }

      await api.post('/participants', payload);
      // Handle success (redirect, show message, etc.)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create participant');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      
      <Input
        type="email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required={!!password}
      />

      <Input
        type="password"
        label="Password (optional - creates user account)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Leave empty for participant without login"
      />

      {password && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isUserEnabled}
            onChange={(e) => setIsUserEnabled(e.target.checked)}
          />
          <span>Enable login for this participant</span>
        </label>
      )}

      {error && <div className="text-red-600">{error}</div>}

      <Button type="submit">Create Participant</Button>
    </form>
  );
}
```

## Testing Checklist

- [ ] Create participant without password (should work)
- [ ] Create participant with password but email missing (should show error)
- [ ] Create participant with password and email (should create user account)
- [ ] Create participant with password, email, and isUserEnabled=true (should create enabled user)
- [ ] List participants shows isPasswordSet and isUserEnabled correctly
- [ ] Update participant password (should work if user exists)
- [ ] Update participant isUserEnabled (should work if user exists)
- [ ] Create user account for existing participant (should work with password + email)
- [ ] Login with disabled account (should fail with clear message)
- [ ] Login with enabled account (should work)

## API Endpoints Summary

### Create Participant
- **POST** `/participants`
- **Body:** `CreateParticipantRequest` (see above)
- **Response:** `Participant` with `isPasswordSet` and `isUserEnabled`

### Update Participant
- **PUT** `/participants/{id}`
- **Body:** `UpdateParticipantRequest` (see above)
- **Response:** `Participant` with `isPasswordSet` and `isUserEnabled`

### Get Participant
- **GET** `/participants/{id}`
- **Response:** `Participant` with `isPasswordSet` and `isUserEnabled`

### List Participants
- **GET** `/participants`
- **Response:** Array of `Participant` with `isPasswordSet` and `isUserEnabled`

### Login
- **POST** `/auth/login`
- **Note:** Now checks both password and `isUserEnabled` status

### Removed
- **POST** `/admin/users` - No longer exists

