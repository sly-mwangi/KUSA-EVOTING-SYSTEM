import { useState } from "react";
import { useLocation } from "wouter";
import {
  useAdminCreatePoll,
  useListSchools,
  useListHostels,
  useListPositions,
  useAdminListUsers,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trash2, Plus, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";

type Seat = {
  code: string;
  label: string;
  scope:
    | "school"
    | "department"
    | "hostel"
    | "sgc"
    | "university"
    | "non-residential"
    | "residential";
  scopeRefId: string;
  gender: "" | "male" | "female";
};

type SlateMember = {
  userId: string;
  seatCode: string;
  role: string;
};

type Slate = {
  name: string;
  slogan: string;
  manifesto: string;
  members: SlateMember[];
};

const newSeat = (): Seat => ({
  code: "",
  label: "",
  scope: "university",
  scopeRefId: "",
  gender: "",
});

const newSlate = (roles: string[]): Slate => ({
  name: "",
  slogan: "",
  manifesto: "",
  members: roles.map((r) => ({
    userId: "",
    seatCode: r.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    role: r,
  })),
});

const SGC_ROLES = [
  "SGC Chairperson",
  "SGC Vice Chairperson",
  "Secretary General",
  "Assistant Secretary General",
  "Treasurer",
  "Academic Affairs Secretary",
  "Social Affairs Secretary",
  "Sports Secretary",
  "Organizing Secretary",
];

export default function AdminCreatePollPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pollType, setPollType] = useState<"sgc" | "general">("general");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [seats, setSeats] = useState<Seat[]>([newSeat()]);
  const [slates, setSlates] = useState<Slate[]>([]);
  const [sgcRoles, setSgcRoles] = useState<string[]>(SGC_ROLES);
  const create = useAdminCreatePoll();
  const schoolsQ = useListSchools();
  const hostelsQ = useListHostels();
  const usersQ = useAdminListUsers();
  const [, navigate] = useLocation();

  const update = (i: number, patch: Partial<Seat>) =>
    setSeats((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const remove = (i: number) =>
    setSeats((s) => s.filter((_, idx) => idx !== i));
  const add = () => setSeats((s) => [...s, newSeat()]);

  const updateSlate = (i: number, patch: Partial<Slate>) =>
    setSlates((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeSlate = (i: number) =>
    setSlates((s) => s.filter((_, idx) => idx !== i));
  const addSlate = () => setSlates((s) => [...s, newSlate(sgcRoles)]);

  const updateSlateMember = (
    slateIdx: number,
    memberIdx: number,
    patch: Partial<SlateMember>,
  ) =>
    setSlates((s) =>
      s.map((slate, sIdx) =>
        sIdx === slateIdx
          ? {
              ...slate,
              members: slate.members.map((m, mIdx) =>
                mIdx === memberIdx ? { ...m, ...patch } : m,
              ),
            }
          : slate,
      ),
    );

  const addSgcTemplate = () => {
    setPollType("sgc");
    setSlates([newSlate(SGC_ROLES)]);
    if (!title) setTitle("SGC (Student Governing Council) Elections");
    toast.success(`Loaded SGC Group template`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !start || !end || seats.length === 0) {
      toast.error("Fill in all fields");
      return;
    }
    if (new Date(end) <= new Date(start)) {
      toast.error("End must be after start");
      return;
    }
    let cleanedSeats = [];
    if (pollType === "sgc") {
      cleanedSeats = sgcRoles.map((r, i) => ({
        code: r.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label: r,
        scope: "university" as const, // SGC is university-wide
        scopeRefId: null,
        gender: null,
        position: i,
      }));
    } else {
      cleanedSeats = seats.map((s, i) => ({
        code: s.code || `seat-${i + 1}`,
        label: s.label,
        scope: s.scope,
        scopeRefId: ["school", "department", "hostel"].includes(s.scope)
          ? s.scopeRefId || null
          : null,
        gender: s.gender || null,
      }));
    }

    if (cleanedSeats.some((s) => !s.label)) {
      toast.error("All seats need a label");
      return;
    }

    if (pollType === "sgc" && slates.length === 0) {
      toast.error("At least one SGC group is required");
      return;
    }
    try {
      // Manual Wall-Clock Fix: Subtract 3 hours from the input to store it as "EAT-as-UTC"
      const toManualUTC = (dateStr: string) => {
        const d = new Date(dateStr);
        // Subtract 3 hours (180 minutes) to counteract the EAT offset
        const manual = new Date(d.getTime() - 3 * 60 * 60 * 1000);
        return manual.toISOString();
      };
      await create.mutateAsync({
        data: {
          title,
          description,
          pollType,
          startDate: toManualUTC(start),
          endDate: toManualUTC(end),
          seats: cleanedSeats,
          slates: pollType === "sgc" ? slates : undefined,
        } as any,
      });
      toast.success("Poll created");
      navigate("/admin/polls");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create poll";
      toast.error(`Error: ${msg}`);
      console.error("Full error:", err);
    }
  };

  const schools = (schoolsQ.data ?? []) as any[];
  const hostels = (hostelsQ.data ?? []) as any[];
  const allDepartments = schools.flatMap((s: any) =>
    (s.departments ?? []).map((d: any) => ({
      id: d.id,
      name: `${s.name} — ${d.name}`,
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create a poll</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define the title, type, voting window and seats.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Poll details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="SGC (Student Governing Council) Elections 2026"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Poll type</Label>
              <RadioGroup
                value={pollType}
                onValueChange={(v) => setPollType(v as any)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sgc" id="t-sgc" />
                  <Label htmlFor="t-sgc" className="font-normal">
                    SGC — Student Governing Council
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="general" id="t-general" />
                  <Label htmlFor="t-general" className="font-normal">
                    General election
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Voting opens</Label>
              <Input
                type="datetime-local"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Voting closes</Label>
              <Input
                type="datetime-local"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {pollType === "sgc" ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>SGC Groups (Slates)</CardTitle>
                  <CardDescription>
                    Create groups for the SGC election. Each group is voted for
                    as a single unit.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const role = prompt("Enter new position name:");
                      if (role) {
                        setSgcRoles((prev) => [...prev, role]);
                        setSlates((prev) =>
                          prev.map((s) => ({
                            ...s,
                            members: [
                              ...s.members,
                              {
                                userId: "",
                                seatCode: role
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, "-"),
                                role,
                              },
                            ],
                          })),
                        );
                      }
                    }}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add position
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addSlate}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add group
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {slates.map((slate, sIdx) => (
                <div
                  key={sIdx}
                  className="space-y-4 rounded-lg border border-border p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Group #{sIdx + 1}</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeSlate(sIdx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Group Name</Label>
                      <Input
                        required
                        value={slate.name}
                        onChange={(e) =>
                          updateSlate(sIdx, { name: e.target.value })
                        }
                        placeholder="e.g. Progressive Alliance"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slogan (Optional)</Label>
                      <Input
                        value={slate.slogan}
                        onChange={(e) =>
                          updateSlate(sIdx, { slogan: e.target.value })
                        }
                        placeholder="e.g. For a better KU"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Manifesto (Optional)</Label>
                      <Textarea
                        value={slate.manifesto}
                        onChange={(e) =>
                          updateSlate(sIdx, { manifesto: e.target.value })
                        }
                        placeholder="Group vision and goals..."
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Members</Label>
                    <div className="grid gap-3">
                      {slate.members.map((member, mIdx) => (
                        <div
                          key={mIdx}
                          className="flex flex-wrap items-center gap-3 rounded-md bg-muted/30 p-3"
                        >
                          <div className="flex-1 min-w-50">
                            <Label className="text-[10px] uppercase text-muted-foreground">
                              {member.role}
                            </Label>
                            <Select
                              value={member.userId}
                              onValueChange={(v) =>
                                updateSlateMember(sIdx, mIdx, { userId: v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select student" />
                              </SelectTrigger>
                              <SelectContent>
                                {((usersQ.data ?? []) as any[])
                                  .filter((u) => u.role === "student")
                                  .map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.name} ({u.registrationNumber})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-4 text-destructive"
                            onClick={() => {
                              const newRoles = sgcRoles.filter(
                                (_, idx) =>
                                  idx !==
                                  sgcRoles.indexOf(slate.members[mIdx].role),
                              );
                              setSgcRoles(newRoles);
                              setSlates((prev) =>
                                prev.map((s) => ({
                                  ...s,
                                  members: s.members.filter(
                                    (_, idx) => idx !== mIdx,
                                  ),
                                })),
                              );
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {slates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
                  <Layers className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No groups added yet. Click "Add group" to start.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Seats / Positions</CardTitle>
                  <CardDescription>
                    Each seat appears as a separate ballot question.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSgcTemplate}
                    className="gap-1"
                  >
                    <Layers className="h-3.5 w-3.5" /> Use SGC template
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={add}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add seat
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {seats.map((s, i) => (
                <div
                  key={i}
                  className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-12"
                >
                  <div className="space-y-1.5 md:col-span-4">
                    <Label>Label</Label>
                    <Input
                      required
                      value={s.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="e.g. Chairperson"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Code</Label>
                    <Input
                      value={s.code}
                      onChange={(e) => update(i, { code: e.target.value })}
                      placeholder="auto"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Scope</Label>
                    <Select
                      value={s.scope}
                      onValueChange={(v) =>
                        update(i, { scope: v as any, scopeRefId: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="university">
                          University-wide
                        </SelectItem>
                        <SelectItem value="school">School</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="hostel">Hostel</SelectItem>
                        <SelectItem value="residential">
                          Residential (hostel students)
                        </SelectItem>
                        <SelectItem value="non-residential">
                          Non-Residential (off-campus)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-3">
                    <Label>Scope target</Label>
                    {s.scope === "school" ? (
                      <Select
                        value={s.scopeRefId}
                        onValueChange={(v) => update(i, { scopeRefId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All / pick" />
                        </SelectTrigger>
                        <SelectContent>
                          {schools.map((x: any) => (
                            <SelectItem key={x.id} value={x.id}>
                              {x.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : s.scope === "department" ? (
                      <Select
                        value={s.scopeRefId}
                        onValueChange={(v) => update(i, { scopeRefId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All / pick" />
                        </SelectTrigger>
                        <SelectContent>
                          {allDepartments.map((x) => (
                            <SelectItem key={x.id} value={x.id}>
                              {x.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : s.scope === "hostel" ? (
                      <Select
                        value={s.scopeRefId}
                        onValueChange={(v) => update(i, { scopeRefId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All / pick" />
                        </SelectTrigger>
                        <SelectContent>
                          {hostels.map((x: any) => (
                            <SelectItem key={x.id} value={x.id}>
                              {x.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        disabled
                        value={
                          s.scope === "residential"
                            ? "Hostel students only"
                            : s.scope === "non-residential"
                              ? "Off-campus students only"
                              : "University-wide"
                        }
                        className="text-muted-foreground"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <Label className="invisible">Remove</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(i)}
                      disabled={seats.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1.5 md:col-span-12">
                    <Label className="text-xs text-muted-foreground">
                      Gender restriction (optional)
                    </Label>
                    <Select
                      value={s.gender || "any"}
                      onValueChange={(v) =>
                        update(i, { gender: v === "any" ? "" : (v as any) })
                      }
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="male">Male only</SelectItem>
                        <SelectItem value="female">Female only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/polls")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending} className="gap-2">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create poll
          </Button>
        </div>
      </form>
    </div>
  );
}
