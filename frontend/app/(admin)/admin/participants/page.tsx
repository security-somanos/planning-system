'use client';
import { useEffect, useMemo, useState } from "react";
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
  const [form, setForm] = useState<Partial<Participant>>({});

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
    setForm({ name: "", roles: [], email: "", phone: "", languages: [] });
    setRoleSearchQuery("");
    setLanguageSearchQuery("");
    setModalOpen(true);
  };
  const openEdit = (p: Participant) => {
    setEditing(p);
    setForm({ name: p.name, roles: p.roles, email: p.email, phone: p.phone, languages: p.languages || [] });
    setRoleSearchQuery("");
    setLanguageSearchQuery("");
    setModalOpen(true);
  };
  const saveForm = async () => {
    if (editing) {
      await mockApi.put(`/participants/${editing.id}`, form);
    } else {
      await mockApi.post("/participants", form);
    }
    setModalOpen(false);
    refresh();
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
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-700">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-700">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-700">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-700">Roles</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-700">Languages</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-700">Events</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {paginatedParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => viewEvents(p)}>
                            View events
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => remove(p)}>
                            Delete
                          </Button>
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
            <div className="mb-1 text-sm font-medium">Email</div>
            <Input value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Phone</div>
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
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


