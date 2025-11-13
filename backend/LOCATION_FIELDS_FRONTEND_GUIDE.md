# Frontend Update Guide: Location Contact and Site Managers

## New Fields Added to Location

```typescript
export interface Location {
  // ... existing fields ...
  contact?: string[];           // NEW: Array of contact information (phone, email, etc.)
  siteManagerIds?: string[];    // NEW: Array of participant IDs who manage this location
}
```

## Quick Updates Needed

### 1. Update Type Definition
Add the two new fields to your `Location` interface in `lib/types.ts`.

### 2. Create/Edit Form
Add these fields to your location form:

**Contact (text array):**
```tsx
const [contacts, setContacts] = useState<string[]>(['']);

// In form:
{contacts.map((contact, idx) => (
  <div key={idx} className="flex gap-2">
    <Input
      value={contact}
      onChange={(e) => {
        const updated = [...contacts];
        updated[idx] = e.target.value;
        setContacts(updated);
      }}
      placeholder="Phone, email, etc."
    />
    {contacts.length > 1 && (
      <Button onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}>
        Remove
      </Button>
    )}
  </div>
))}
<Button onClick={() => setContacts([...contacts, ''])}>+ Add Contact</Button>
```

**Site Managers (participant IDs):**
```tsx
const [selectedSiteManagers, setSelectedSiteManagers] = useState<string[]>([]);
const [participants, setParticipants] = useState<Participant[]>([]);

// Load participants
useEffect(() => {
  api.get<{ items: Participant[] }>('/participants')
    .then(res => setParticipants(res.items));
}, []);

// In form (checkbox approach):
<div className="border rounded p-2 max-h-48 overflow-y-auto">
  {participants.map(p => (
    <label key={p.id} className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={selectedSiteManagers.includes(p.id)}
        onChange={(e) => {
          if (e.target.checked) {
            setSelectedSiteManagers([...selectedSiteManagers, p.id]);
          } else {
            setSelectedSiteManagers(selectedSiteManagers.filter(id => id !== p.id));
          }
        }}
      />
      <span>{p.name}</span>
    </label>
  ))}
</div>
```

**Submit payload:**
```tsx
const payload = {
  // ... existing fields ...
  contact: contacts.filter(c => c.trim() !== ''),
  siteManagerIds: selectedSiteManagers.length > 0 ? selectedSiteManagers : undefined,
};
```

### 3. Display in List/Detail Views
```tsx
{/* Contact */}
{location.contact && location.contact.length > 0 && (
  <div>
    <label>Contact</label>
    {location.contact.map((c, idx) => <div key={idx}>{c}</div>)}
  </div>
)}

{/* Site Managers */}
{location.siteManagerIds && location.siteManagerIds.length > 0 && (
  <div>
    <label>Site Managers</label>
    {location.siteManagerIds.map(id => {
      const participant = participants.find(p => p.id === id);
      return <div key={id}>{participant?.name || id}</div>;
    })}
  </div>
)}
```

## API
No changes to endpoints - just include `contact` and `siteManagerIds` in POST/PUT requests. They're returned in GET responses.

