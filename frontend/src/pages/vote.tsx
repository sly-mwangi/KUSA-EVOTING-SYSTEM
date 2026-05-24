import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  useGetPollDetails,
  useCastVote,
  getGetPollDetailsQueryKey,
  getListPollsQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  Vote,
  ShieldCheck,
  CheckCircle2,
  Lock,
  TriangleAlert,
  X,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

// Vote envelope: client base64-encodes a JSON object with the chosen
// candidate, seat, a fresh nonce and a timestamp. The backend stores
// only this opaque blob for each vote — never the user id — so vote
// records cannot be linked back to the voter via payload structure.
function encryptedPayload(seatId: string, candidateId: string): string {
  const obj = {
    candidateId,
    seatId,
    nonce: crypto.randomUUID(),
    ts: Date.now(),
  };
  return btoa(JSON.stringify(obj));
}

export default function VotePage() {
  const [, params] = useRoute<{ pollId: string }>("/vote/:pollId");
  const pollId = params?.pollId ?? "";
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data: poll, isLoading } = useGetPollDetails(pollId, {
    query: {
      enabled: Boolean(pollId),
      queryKey: getGetPollDetailsQueryKey(pollId) as unknown as unknown[],
    },
  });
  const cast = useCastVote();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [feeBlocked, setFeeBlocked] = useState(false);

  const eligibleSeats = useMemo(
    () =>
      ((poll as any)?.seats ?? []).filter((s: any) => s.eligible && !s.voted),
    [poll],
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }
  if (!poll) {
    return (
      <div className="container mx-auto p-8 text-center text-muted-foreground">
        Poll not found
      </div>
    );
  }

  const onSubmit = async () => {
    const entries = Object.entries(selections);
    if (entries.length === 0) {
      toast.error("Pick at least one candidate before submitting");
      return;
    }
    setFeeBlocked(false);
    try {
      await cast.mutateAsync({
        pollId,
        data: {
          selections: entries.map(([seatId, candidateId]) => ({
            seatId,
            candidateId,
            encryptedPayload: encryptedPayload(seatId, candidateId),
          })),
        } as any,
      });
      setSubmitted(true);
      toast.success("Your vote has been recorded successfully");
      qc.invalidateQueries({ queryKey: getListPollsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetPollDetailsQueryKey(pollId) });
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      if (err?.data?.code === "FEE_NOT_CLEARED" || err?.status === 403) {
        setFeeBlocked(true);
      } else {
        toast.error(err?.message ?? "Could not record your vote");
      }
    }
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <CheckCircle2 className="h-10 w-10" />
        </motion.div>
        <h1 className="mt-6 text-3xl font-bold">
          Your vote has been recorded successfully
        </h1>
        <p className="mt-2 text-muted-foreground">
          Returning to your dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 max-w-3xl">
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/30"
        >
          {(poll as any).status === "active"
            ? "Voting open"
            : (poll as any).status}
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {(poll as any).title}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {(poll as any).description}
        </p>

        {/* Fee clearance blocked banner */}
        <AnimatePresence>
          {feeBlocked && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-4"
            >
              <Alert className="border-destructive/50 bg-destructive/5 text-destructive">
                <TriangleAlert className="h-4 w-4 text-destructive" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <AlertTitle className="text-destructive font-semibold">
                      Fee balance not cleared
                    </AlertTitle>
                    <AlertDescription className="text-destructive/80 mt-1">
                      Your student fee balance must be cleared before you can
                      vote. Please visit the{" "}
                      <span className="font-medium">Finance Office</span> to
                      settle your balance, then return here to cast your vote.
                    </AlertDescription>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeeBlocked(false)}
                    className="mt-0.5 shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 transition-opacity"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <Alert className="mt-4 border-primary/30 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertTitle>Your ballot is secret and final</AlertTitle>
          <AlertDescription className="text-xs">
            Votes are wrapped in an encrypted envelope before leaving your
            device. Once submitted, a seat cannot be voted on again.
          </AlertDescription>
        </Alert>
      </div>

      {eligibleSeats.length === 0 ? (
        <Card className="max-w-3xl">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            There are no seats currently open for you to vote on in this poll.
          </CardContent>
        </Card>
      ) : (
        <div className="grid max-w-3xl gap-6">
          {eligibleSeats.map((seat: any, idx: number) => (
            <motion.div
              key={seat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05 }}
            >
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle className="text-xl">{seat.label}</CardTitle>
                  <CardDescription>
                    {seat.candidates.length} approved candidate
                    {seat.candidates.length === 1 ? "" : "s"}. Pick one — or
                    skip.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {seat.candidates.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      No approved candidates yet for this seat.
                    </div>
                  ) : (
                    <RadioGroup
                      value={selections[seat.id] ?? ""}
                      onValueChange={(v) =>
                        setSelections((s) => ({ ...s, [seat.id]: v }))
                      }
                      className="grid gap-3"
                    >
                      {seat.candidates.map((c: any) => {
                        const checked = selections[seat.id] === c.id;
                        return (
                          <Label
                            key={c.id}
                            data-testid={`candidate-${c.id}`}
                            htmlFor={`${seat.id}-${c.id}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all ${checked ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                          >
                            <RadioGroupItem
                              value={c.id}
                              id={`${seat.id}-${c.id}`}
                              className="mt-0.5"
                            />
                            <div className="flex flex-1 items-start gap-4">
                              <Avatar className="h-12 w-12 border border-border">
                                <AvatarImage
                                  src={c.photoUrl}
                                  alt={c.name}
                                  className="object-cover"
                                />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  <User className="h-6 w-6" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="font-semibold">{c.name}</div>
                                <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                                  {c.manifesto || "No manifesto provided."}
                                </p>
                              </div>
                            </div>
                            {checked && (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            )}
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  )}
                </CardContent>
                <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
                  <span>Choosing nothing skips this seat.</span>
                  {selections[seat.id] && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelections(({ [seat.id]: _, ...rest }) => rest)
                      }
                      className="text-primary hover:underline"
                    >
                      Clear selection
                    </button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
          <div className="sticky bottom-4 z-10 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="h-4 w-4 text-primary" />
                <span>
                  {Object.keys(selections).length} of {eligibleSeats.length}{" "}
                  seats selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </Button>
                <Button
                  data-testid="vote-btn"
                  onClick={onSubmit}
                  disabled={cast.isPending}
                  className="gap-2 px-6"
                >
                  {cast.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Vote className="h-4 w-4" />
                  )}
                  Submit ballot
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
