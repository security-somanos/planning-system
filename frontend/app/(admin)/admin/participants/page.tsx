'use client';
import { useEffect, useMemo, useState } from "react";
import { Edit, Trash2, Calendar } from "lucide-react";
import { AdminLayout } from "../../../../components/layout/AdminLayout";
import { mockApi } from "../../../../lib/mockApi";
import { Participant } from "../../../../lib/types";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
import { Select } from "../../../../components/ui/Select";
import { PARTICIPANT_ROLES, LANGUAGES } from "../../../../lib/constants";

type AgendaItem = {
  eventId: string;
  dayId: string;
  date: string;
  block: { id: string; title: string; startTime: string; endTime: string };
};

const ITEMS_PER_PAGE = 20;

export default function ParticipantManagerPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Participant | null>(null);
  const [form, setForm] = useState<Partial<Participant> & { password?: string }>({});
  const [formError, setFormError] = useState("");

  const [viewAgendaFor, setViewAgendaFor] = useState<Participant | null>(null);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);

  // Filters and pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  // Form search states
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [languageSearchQuery, setLanguageSearchQuery] = useState("");
  const [roleInputFocused, setRoleInputFocused] = useState(false);
  const [languageInputFocused, setLanguageInputFocused] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
    setLoading(true);
    mockApi
      .get<{ items: Participant[] }>("/participants")
      .then((res) => setParticipants(res.items))
      .catch(() => setError("Failed to load participants."))
      .finally(() => setLoading(false));
  };

  // Filter participants
  const filteredParticipants = useMemo(() => {
    let filtered = [...participants];

    // Search by name or email
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.email && p.email.toLowerCase().includes(query))
      );
    }

    // Filter by role
    if (selectedRole) {
      filtered = filtered.filter((p) => p.roles && p.roles.includes(selectedRole));
    }

    return filtered;
  }, [participants, searchQuery, selectedRole]);

  // Pagination
  const totalPages = Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE);
  const paginatedParticipants = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredParticipants.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredParticipants, currentPage]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchQuery, selectedRole]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", roles: [], email: "", phone: "", languages: [], password: "" });
    setFormError("");
    setRoleSearchQuery("");
    setLanguageSearchQuery("");
    setModalOpen(true);
  };
  const openEdit = (p: Participant) => {
    setEditing(p);
    setForm({ 
      name: p.name, 
      roles: p.roles, 
      email: p.email, 
      phone: p.phone, 
      languages: p.languages || [],
      password: "",
      isUserEnabled: p.isUserEnabled !== null && p.isUserEnabled !== undefined ? p.isUserEnabled : undefined
    });
    setFormError("");
    setRoleSearchQuery("");
    setLanguageSearchQuery("");
    setModalOpen(true);
  };
  const saveForm = async () => {
    setFormError("");
    
    // Validation: If password is provided, email is required
    if (form.password && !form.email) {
      setFormError("Email is required when creating a user account");
      return;
    }

    // Validation: If enable login is checked, password is required (unless editing and password already exists)
    if (form.isUserEnabled && !form.password && (!editing || !editing.isPasswordSet)) {
      setFormError("Password is required when enabling login");
      return;
    }

    try {
      const payload: any = {
        name: form.name,
        roles: form.roles,
        email: form.email,
        phone: form.phone,
        languages: form.languages,
      };

      if (editing) {
        // Update participant
        // Only include password if it's being changed
        if (form.password) {
          payload.password = form.password;
        }
        
        // Include isUserEnabled if user account exists or is being created
        if (editing.userId || form.password) {
          payload.isUserEnabled = form.isUserEnabled ?? false;
        }
        
        await mockApi.put(`/participants/${editing.id}`, payload);
      } else {
        // Create participant
        // Only include password and isUserEnabled if password is provided
        if (form.password) {
          payload.password = form.password;
          payload.isUserEnabled = form.isUserEnabled ?? false;
        }
        
        await mockApi.post("/participants", payload);
      }
      
      setModalOpen(false);
      refresh();
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Failed to save participant");
    }
  };
  const remove = async (p: Participant) => {
    if (!confirm("Delete this participant? They will be removed from events.")) return;
    await mockApi.delete(`/participants/${p.id}`);
    refresh();
  };
  const viewEvents = async (p: Participant) => {
    setViewAgendaFor(p);
    const res = await mockApi.get<{ items: AgendaItem[] }>(`/agenda/${p.id}`);
    setAgenda(res.items);
  };

  return (
    <AdminLayout title="Participant Manager">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Participants</div>
        <Button onClick={openCreate}>Add participant</Button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-sm font-medium">Search</div>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
          />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">Filter by Role</div>
          <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            <option value="">All roles</option>
            {PARTICIPANT_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <>
          <div className="mb-2 text-sm text-zinc-600">
            Showing {paginatedParticipants.length} of {filteredParticipants.length} participants
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full">
              <thead
                style={{
                  background: `linear-gradient(to bottom, rgb(198, 123, 129), rgb(135, 18, 27))`,
                }}
              >
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(189, 168, 109)' }}>Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(189, 168, 109)' }}>Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(189, 168, 109)' }}>Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(189, 168, 109)' }}>Roles</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(189, 168, 109)' }}>Languages</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(189, 168, 109)' }}>Events</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(189, 168, 109)' }}>Login</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'rgb(189, 168, 109)' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {paginatedParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No participants found
                    </td>
                  </tr>
                ) : (
                  paginatedParticipants.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{p.email || "—"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{p.phone || "—"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {p.roles && p.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.roles.map((role) => (
                              <span
                                key={role}
                                className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {p.languages && p.languages.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.languages.map((lang) => (
                              <span
                                key={lang}
                                className="inline-block rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 border border-blue-200"
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{p.assignedBlockIds?.length ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {p.isUserEnabled === true ? (
                          <span className="inline-block rounded bg-green-50 px-2 py-0.5 text-xs text-green-700 border border-green-200">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="p-1.5 hover:bg-zinc-100 rounded transition-colors"
                            onClick={() => viewEvents(p)}
                            title="View events"
                          >
                            <Calendar className="h-4 w-4 text-zinc-600" />
                          </button>
                          <button
                            className="p-1.5 hover:bg-zinc-100 rounded transition-colors"
                            onClick={() => openEdit(p)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4 text-zinc-600" />
                          </button>
                          <button
                            className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            onClick={() => remove(p)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-[#920712]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-zinc-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show first page, last page, current page, and pages around current
                      return (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      );
                    })
                    .map((page, idx, arr) => {
                      // Add ellipsis if there's a gap
                      const showEllipsisBefore = idx > 0 && arr[idx - 1] < page - 1;
                      return (
                        <div key={page} className="flex items-center gap-1">
                          {showEllipsisBefore && <span className="px-2 text-zinc-400">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 text-sm rounded cursor-pointer ${
                              currentPage === page
                                ? "bg-blue-600 text-white"
                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      );
                    })}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
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
        title={editing ? "Edit participant" : "Add participant"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveForm}>{editing ? "Save changes" : "Create"}</Button>
          </div>
        }
      >
        {formError && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Name</div>
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Roles</div>
            <div className="space-y-2">
              {(form.roles as string[]) && (form.roles as string[]).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(form.roles as string[]).map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            roles: (f.roles as string[]).filter((r) => r !== role),
                          }));
                        }}
                        className="text-zinc-500 hover:text-zinc-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  value={roleSearchQuery}
                  onChange={(e) => setRoleSearchQuery(e.target.value)}
                  onFocus={() => {
                    setRoleInputFocused(true);
                    setRoleSearchQuery("");
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setRoleInputFocused(false), 200);
                  }}
                  placeholder="Search and add roles..."
                />
                {roleInputFocused && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-zinc-200 bg-white shadow-lg">
                    {(() => {
                      const availableRoles = PARTICIPANT_ROLES.filter(
                        (role) => !(form.roles as string[])?.includes(role)
                      );
                      const filteredRoles = roleSearchQuery.trim().length > 0
                        ? availableRoles.filter((role) =>
                            role.toLowerCase().includes(roleSearchQuery.toLowerCase())
                          )
                        : availableRoles;

                      return filteredRoles.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">No roles found</div>
                      ) : (
                        filteredRoles.map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                roles: [...((f.roles as string[]) || []), role],
                              }));
                              setRoleSearchQuery("");
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 cursor-pointer"
                          >
                            {role}
                          </button>
                        ))
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Email {form.password ? <span className="text-red-600">*</span> : ""}</div>
            <Input 
              value={form.email ?? ""} 
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required={!!form.password}
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Phone</div>
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Login (optional - creates user account)</div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isUserEnabled"
                  checked={form.isUserEnabled ?? false}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setForm((f) => ({ 
                      ...f, 
                      isUserEnabled: enabled,
                      // Clear password if disabling login
                      password: enabled ? f.password : ""
                    }));
                  }}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isUserEnabled" className="text-sm text-zinc-700 cursor-pointer">
                  Enable login for this participant
                </label>
              </div>
              {form.isUserEnabled && (
                <div>
                  <div className="mb-1 text-sm font-medium">
                    {editing && editing.isPasswordSet ? "Update password" : "New password"}
                    {editing && editing.isPasswordSet && " (leave blank to keep current)"}
                  </div>
                  <Input
                    type="password"
                    value={form.password ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={editing && editing.isPasswordSet ? "Enter new password or leave blank" : "Enter password"}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">Languages</div>
            <div className="space-y-2">
              {(form.languages as string[]) && (form.languages as string[]).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(form.languages as string[]).map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-200"
                    >
                      {lang}
                      <button
                        type="button"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            languages: (f.languages as string[]).filter((l) => l !== lang),
                          }));
                        }}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  value={languageSearchQuery}
                  onChange={(e) => setLanguageSearchQuery(e.target.value)}
                  onFocus={() => setLanguageInputFocused(true)}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setLanguageInputFocused(false), 200);
                  }}
                  placeholder="Search and add languages... (type at least 1 letter)"
                />
                {languageInputFocused && languageSearchQuery.trim().length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-zinc-200 bg-white shadow-lg">
                    {(() => {
                      const query = languageSearchQuery.toLowerCase();
                      const availableLanguages = LANGUAGES.filter(
                        (lang) => !(form.languages as string[])?.includes(lang)
                      );
                      
                      // Separate: starts with query, then includes query
                      const startsWith = availableLanguages.filter((lang) =>
                        lang.toLowerCase().startsWith(query)
                      );
                      const includes = availableLanguages.filter(
                        (lang) =>
                          lang.toLowerCase().includes(query) &&
                          !lang.toLowerCase().startsWith(query)
                      );
                      
                      const sortedLanguages = [...startsWith, ...includes];

                      return sortedLanguages.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">No languages found</div>
                      ) : (
                        sortedLanguages.map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                languages: [...((f.languages as string[]) || []), lang],
                              }));
                              setLanguageSearchQuery("");
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 cursor-pointer"
                          >
                            {lang}
                          </button>
                        ))
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!viewAgendaFor} onClose={() => setViewAgendaFor(null)} title={`Events for ${viewAgendaFor?.name}`}>
        {agenda.length === 0 ? (
          <div className="text-sm text-zinc-600">No events assigned.</div>
        ) : (
          <div className="space-y-3">
            {agenda.map((a) => (
              <div key={`${a.dayId}-${a.block.id}`} className="rounded border border-zinc-200 p-3">
                <div className="text-xs text-zinc-600">{a.date}</div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="font-medium">{a.block.title}</div>
                  <div className="text-xs text-zinc-600">
                    {a.block.startTime}–{a.block.endTime}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}


