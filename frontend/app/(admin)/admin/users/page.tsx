'use client';
import { useEffect, useState } from "react";
import { AdminLayout } from "../../../../components/layout/AdminLayout";
import { api } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Modal } from "../../../../components/ui/Modal";

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt?: string;
  updatedAt?: string;
}

interface Participant {
  id: string;
  name: string;
  roles?: string[];
  email?: string;
  phone?: string;
  languages?: string[];
  userId?: string;
}

const ITEMS_PER_PAGE = 20;

export default function UserManagerPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<{
    email: string;
    password: string;
    role: 'admin' | 'user';
    participantId?: string;
  }>({
    email: "",
    password: "",
    role: "user",
  });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    refresh();
    loadParticipants();
  }, [currentPage]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const response = await api.get<{ items: User[]; total: number }>(
        `/admin/users?limit=${ITEMS_PER_PAGE}&offset=${offset}`
      );
      setUsers(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadParticipants = async () => {
    try {
      const response = await api.get<{ items: Participant[] }>('/participants');
      setParticipants(response.items);
    } catch (err) {
      // Silently fail - participants are optional
      console.error('Failed to load participants:', err);
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const openCreate = () => {
    setEditing(null);
    setForm({ email: "", password: "", role: "user", participantId: undefined });
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    // Find participant linked to this user
    const linkedParticipant = participants.find(p => p.userId === u.id);
    setForm({
      email: u.email,
      password: "", // Don't pre-fill password
      role: u.role,
      participantId: linkedParticipant?.id,
    });
    setModalOpen(true);
  };

  const saveForm = async () => {
    try {
      setError("");
      
      if (editing) {
        // Update user
        const updatePayload: { email?: string; role?: 'admin' | 'user' } = {};
        if (form.email !== editing.email) {
          updatePayload.email = form.email;
        }
        if (form.role !== editing.role) {
          updatePayload.role = form.role;
        }
        
        await api.put(`/admin/users/${editing.id}`, updatePayload);
        
        // Update participant link if changed
        const currentLinkedParticipant = participants.find(p => p.userId === editing.id);
        if (form.participantId !== currentLinkedParticipant?.id) {
          // Unlink old participant
          if (currentLinkedParticipant) {
            const fullParticipant = await api.get<{ item: Participant }>(`/participants/${currentLinkedParticipant.id}`);
            await api.put(`/participants/${currentLinkedParticipant.id}`, {
              name: fullParticipant.item.name,
              roles: fullParticipant.item.roles || [],
              email: fullParticipant.item.email,
              phone: fullParticipant.item.phone,
              languages: fullParticipant.item.languages || [],
              userId: undefined,
            });
          }
          
          // Link new participant
          if (form.participantId) {
            const fullParticipant = await api.get<{ item: Participant }>(`/participants/${form.participantId}`);
            await api.put(`/participants/${form.participantId}`, {
              name: fullParticipant.item.name,
              roles: fullParticipant.item.roles || [],
              email: fullParticipant.item.email,
              phone: fullParticipant.item.phone,
              languages: fullParticipant.item.languages || [],
              userId: editing.id,
            });
          }
        }
      } else {
        // Create user
        const createPayload: { email: string; password: string; role: 'admin' | 'user' } = {
          email: form.email,
          password: form.password,
          role: form.role,
        };
        
        const newUser = await api.post<{ item: User }>('/admin/users', createPayload);
        
        // Link participant if selected
        if (form.participantId) {
          const fullParticipant = await api.get<{ item: Participant }>(`/participants/${form.participantId}`);
          await api.put(`/participants/${form.participantId}`, {
            name: fullParticipant.item.name,
            roles: fullParticipant.item.roles || [],
            email: fullParticipant.item.email,
            phone: fullParticipant.item.phone,
            languages: fullParticipant.item.languages || [],
            userId: newUser.item.id,
          });
        }
      }
      
      setModalOpen(false);
      await refresh();
      await loadParticipants(); // Refresh participants to get updated userId links
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user.");
    }
  };

  const remove = async (u: User) => {
    if (!confirm(`Delete user ${u.email}? This action cannot be undone.`)) return;
    
    try {
      // Unlink participant first
      const linkedParticipant = participants.find(p => p.userId === u.id);
      if (linkedParticipant) {
        const fullParticipant = await api.get<{ item: Participant }>(`/participants/${linkedParticipant.id}`);
        await api.put(`/participants/${linkedParticipant.id}`, {
          name: fullParticipant.item.name,
          roles: fullParticipant.item.roles || [],
          email: fullParticipant.item.email,
          phone: fullParticipant.item.phone,
          languages: fullParticipant.item.languages || [],
          userId: undefined,
        });
      }
      
      await api.delete(`/admin/users/${u.id}`);
      await refresh();
      await loadParticipants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    }
  };

  const getLinkedParticipant = (userId: string) => {
    return participants.find(p => p.userId === userId);
  };

  return (
    <AdminLayout title="User Manager">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Users</div>
        <Button onClick={openCreate}>Add user</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : (
        <>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700">Email</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700">Role</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700">Participant</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700">Created</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-zinc-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const linkedParticipant = getLinkedParticipant(u.id);
                  return (
                    <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-2 text-sm">{u.email}</td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-600">
                        {linkedParticipant ? (
                          <span className="text-zinc-900">{linkedParticipant.name}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-600">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" onClick={() => openEdit(u)}>
                            Edit
                          </Button>
                          <Button variant="danger" onClick={() => remove(u)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-zinc-600">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit user" : "Add user"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveForm}>{editing ? "Save changes" : "Create"}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <div>
            <div className="mb-1 text-sm font-medium">Email</div>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com"
            />
          </div>

          {!editing && (
            <div>
              <div className="mb-1 text-sm font-medium">Password</div>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
          )}

          {editing && (
            <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm text-zinc-600">
              Password cannot be changed here. Users must reset their password through the system.
            </div>
          )}

          <div>
            <div className="mb-1 text-sm font-medium">Role</div>
            <Select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Link to Participant (Optional)</div>
            <Select
              value={form.participantId || ""}
              onChange={(e) => setForm((f) => ({ ...f, participantId: e.target.value || undefined }))}
            >
              <option value="">— No participant —</option>
              {participants
                .filter((p) => !p.userId || p.userId === editing?.id) // Show unlinked participants or the one linked to this user
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.userId && p.userId !== editing?.id ? '(already linked)' : ''}
                  </option>
                ))}
            </Select>
            <div className="mt-1 text-xs text-zinc-500">
              Link this user to a participant to enable access control. Users can only see data where their participant is involved.
            </div>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}

