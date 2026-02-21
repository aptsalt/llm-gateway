"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const mockMembers = [
  { id: "1", email: "you@example.com", role: "owner", joinedAt: "2024-02-15" },
  { id: "2", email: "teammate@example.com", role: "member", joinedAt: "2024-02-18" },
];

export default function SettingsPage() {
  const [orgName, setOrgName] = useState("Acme Inc");
  const [members, setMembers] = useState(mockMembers);
  const [inviteEmail, setInviteEmail] = useState("");

  const handleUpdateOrg = () => {
    toast.success("Organization settings updated");
  };

  const handleInvite = () => {
    if (!inviteEmail) return;
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail("");
  };

  const handleRemoveMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
    toast.success("Member removed");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-zinc-400">Manage your organization</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription className="text-zinc-400">
            Basic information about your organization
          </CardDescription>
        </CardHeader>
        <div className="p-6 border-t border-zinc-800 space-y-4">
          <div className="space-y-2">
            <label htmlFor="orgName" className="text-sm font-medium">
              Organization Name
            </label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="orgSlug" className="text-sm font-medium">
              Organization Slug
            </label>
            <Input
              id="orgSlug"
              value="acme-inc"
              disabled
              className="bg-zinc-950 text-zinc-500"
            />
            <p className="text-xs text-zinc-500">
              The slug cannot be changed after creation
            </p>
          </div>

          <Button onClick={handleUpdateOrg}>Save Changes</Button>
        </div>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription className="text-zinc-400">
            Manage who has access to your organization
          </CardDescription>
        </CardHeader>
        <div className="p-6 border-t border-zinc-800">
          <div className="space-y-4 mb-6">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button onClick={handleInvite} disabled={!inviteEmail}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">Joined</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-zinc-800 last:border-0">
                    <td className="py-3 pr-4 font-medium">{member.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                        {member.role}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">{member.joinedAt}</td>
                    <td className="py-3">
                      {member.role !== "owner" && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="rounded p-1 hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
                          title="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription className="text-zinc-400">
            Gateway endpoint and authentication
          </CardDescription>
        </CardHeader>
        <div className="p-6 border-t border-zinc-800 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Gateway Endpoint</label>
            <Input
              value="http://localhost:4000"
              disabled
              className="bg-zinc-950 text-zinc-500 font-mono text-sm"
            />
            <p className="text-xs text-zinc-500">
              Your gateway API base URL
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">OpenAI-Compatible Endpoint</label>
            <Input
              value="http://localhost:4000/v1"
              disabled
              className="bg-zinc-950 text-zinc-500 font-mono text-sm"
            />
            <p className="text-xs text-zinc-500">
              Use this with OpenAI SDK clients
            </p>
          </div>
        </div>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription className="text-zinc-400">
            Irreversible actions
          </CardDescription>
        </CardHeader>
        <div className="p-6 border-t border-zinc-800">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-500">Delete Organization</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  This will permanently delete your organization, all API keys, and usage data.
                  This action cannot be undone.
                </p>
                <Button variant="destructive" size="sm" className="mt-3">
                  Delete Organization
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
