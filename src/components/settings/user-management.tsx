"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUserAction, deleteUserAction } from "@/lib/actions/user.actions";
import {
  UserPlus, Trash2, Loader2, CheckCircle, Eye, EyeOff, Mail,
  User, Lock, ShieldCheck, X,
} from "lucide-react";

export interface SerializedUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isCurrentUser: boolean;
}

interface Props {
  users: SerializedUser[];
}

function avatarColor(name: string) {
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500", "bg-rose-500", "bg-teal-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function UserManagement({ users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    setFormSuccess("");
    const result = await createUserAction({ name: name.trim(), email: email.trim(), password });
    setCreating(false);
    if (result.success) {
      setUsers((prev) => [
        ...prev,
        { id: result.data.id, name: result.data.name, email: result.data.email, createdAt: new Date().toISOString(), isCurrentUser: false },
      ]);
      setFormSuccess(`User "${result.data.name}" created successfully`);
      setName("");
      setEmail("");
      setPassword("");
      setTimeout(() => { setShowForm(false); setFormSuccess(""); }, 2000);
    } else {
      setFormError(result.error ?? "Failed to create user");
    }
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId);
    setDeleteError("");
    const result = await deleteUserAction(userId);
    setDeletingId(null);
    if (result.success) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } else {
      setDeleteError(result.error ?? "Failed to delete user");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Login Accounts
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage who can sign in to this system
          </p>
        </div>
        <Button size="sm" onClick={() => { setShowForm((v) => !v); setFormError(""); setFormSuccess(""); }}>
          {showForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add User"}
        </Button>
      </div>

      {/* Add user form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">New Login Account</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Full Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Suraj Kumar"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. suraj@dairy.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}
          {formSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 shrink-0" /> {formSuccess}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {creating ? "Creating…" : "Create Account"}
            </Button>
          </div>
        </form>
      )}

      {/* Delete error banner */}
      {deleteError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {deleteError}
        </p>
      )}

      {/* User list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {users.map((u, i) => (
          <div
            key={u.id}
            className={`flex items-center justify-between gap-3 px-4 py-3 ${i < users.length - 1 ? "border-b border-gray-100" : ""}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarColor(u.name)}`}>
                {getInitials(u.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm truncate">{u.name}</p>
                  {u.isCurrentUser && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">You</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <p className="text-xs text-gray-400 hidden sm:block">
                Added {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              {!u.isCurrentUser && (
                <button
                  onClick={() => handleDelete(u.id)}
                  disabled={deletingId === u.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  title="Delete user"
                >
                  {deletingId === u.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
