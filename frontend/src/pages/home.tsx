import { useAuth } from "@/lib/auth";
import {
  useListActivePollsPublic,
  useListPolls,
  getListActivePollsPublicQueryKey,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  CalendarClock,
  ShieldCheck,
  Vote,
  ArrowRight,
  LogIn,
  UserPlus,
  Lock,
} from "lucide-react";

function format(d: string) {
  const date = new Date(d);
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return eat.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-primary/15 text-primary border-primary/30",
    upcoming: "bg-chart-3/15 text-chart-3 border-chart-3/30",
    closed: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`${map[status] ?? ""} font-medium`}>
      {status === "active"
        ? "Voting Open"
        : status === "upcoming"
          ? "Upcoming"
          : "Closed"}
    </Badge>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const publicPolls = useListActivePollsPublic({
    query: {
      enabled: !isAuthenticated,
      queryKey: getListActivePollsPublicQueryKey() as unknown as unknown[],
    },
  });
  const userPolls = useListPolls({
    query: {
      enabled: isAuthenticated,
      queryKey: getListPollsQueryKey() as unknown as unknown[],
    },
  });
  const polls = (
    (isAuthenticated
      ? (userPolls.data ?? [])
      : (publicPolls.data ?? [])) as any[]
  ).filter(Boolean);
  const isLoading = isAuthenticated
    ? userPolls.isLoading
    : publicPolls.isLoading;
  const safeDate = (value: unknown) => {
    const d = new Date(String(value ?? ""));
    return Number.isNaN(d.getTime()) ? "Unavailable" : format(String(value));
  };

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border bg-linear-to-br from-secondary via-secondary to-secondary/90 text-secondary-foreground">
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <div className="absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-primary blur-3xl" />
          <div className="absolute -bottom-32 right-10 h-96 w-96 rounded-full bg-chart-3 blur-3xl" />
        </div>
        <div className="container mx-auto relative px-4 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <Badge className="bg-primary/20 text-primary border-primary/40 mb-5 font-medium">
              Kenyatta University Students Association
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              KUSA E-Voting <span className="text-primary">System</span>
            </h1>
            <p className="mt-6 text-base leading-relaxed text-secondary-foreground/85 md:text-lg">
              WELCOME TO KUSA VOTING E-VOTING SYSTEM, WHERE YOU GET A CHANCE TO
              VOTE LEADERS OF YOUR CHOICE. Cast your vote, make it count. NOTE
              that your vote is strictly confidential and can only be submitted
              once.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="lg" className="gap-2">
                    Go to Dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button size="lg" className="gap-2">
                      <LogIn className="h-4 w-4" /> Student Sign in
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="gap-2 bg-secondary-foreground/10 text-secondary-foreground border border-secondary-foreground/20 hover:bg-secondary-foreground/20"
                    >
                      <UserPlus className="h-4 w-4" /> Register
                    </Button>
                  </Link>
                  <Link href="/admin/login">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="gap-2 text-secondary-foreground hover:bg-secondary-foreground/10"
                    >
                      <ShieldCheck className="h-4 w-4" /> Admin
                    </Button>
                  </Link>
                </>
              )}
            </div>
            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 max-w-2xl">
              {[
                { Icon: ShieldCheck, label: "Encrypted ballot envelope" },
                { Icon: Lock, label: "One vote per seat" },
                { Icon: Vote, label: "Verified KU email" },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-secondary-foreground/15 bg-secondary-foreground/5 p-3 text-sm"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Live Polls</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAuthenticated
                ? "All polls you are eligible for, with real-time status."
                : "These polls are open to all eligible KU students. Sign in to cast your vote."}
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl bg-muted/40"
              />
            ))}
          </div>
        )}
        {!isLoading && polls.length === 0 && (
          <Card className="bg-card/60">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground" />
              <p className="text-base font-medium">
                No active polls right now.
              </p>
              <p className="text-sm text-muted-foreground">
                Check back soon — KUSA elections are announced here as soon as
                they open.
              </p>
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {polls.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="h-full border-border/80 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-snug">
                      {p.title}
                    </CardTitle>
                    <StatusBadge status={p.status} />
                  </div>
                  <CardDescription className="line-clamp-2">
                    {p.description || "Official KUSA poll"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>Opens: {safeDate(p.startDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>Closes: {safeDate(p.endDate)}</span>
                  </div>
                  {isAuthenticated && (
                    <div className="pt-1">
                      <Badge
                        variant={p.hasVotedAll ? "default" : "outline"}
                        className={
                          p.hasVotedAll
                            ? "bg-primary/20 text-primary border-primary/30"
                            : ""
                        }
                      >
                        {p.hasVotedAll
                          ? "You have voted"
                          : `${p.votedSeats ?? 0}/${p.totalSeatsForUser ?? 0} seats voted`}
                      </Badge>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  {!isAuthenticated ? (
                    <Link href="/login" className="w-full">
                      <Button variant="outline" className="w-full gap-1">
                        <LogIn className="h-4 w-4" /> Sign in to vote
                      </Button>
                    </Link>
                  ) : p.status === "active" ? (
                    p.hasVotedAll ? (
                      <Button variant="outline" className="w-full" disabled>
                        You have voted
                      </Button>
                    ) : (
                      <Link href={`/vote/${p.id}`} className="w-full">
                        <Button className="w-full gap-1">
                          <Vote className="h-4 w-4" /> Cast your vote
                        </Button>
                      </Link>
                    )
                  ) : p.status === "closed" ? (
                    <Link href={`/results/${p.id}`} className="w-full">
                      <Button variant="outline" className="w-full">
                        View Results
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Opens {format(p.startDate)}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
