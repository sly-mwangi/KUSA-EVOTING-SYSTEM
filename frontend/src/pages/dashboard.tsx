import { useListPolls } from "@workspace/api-client-react";
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
import { CalendarClock, CheckCircle2, Vote, BarChart3 } from "lucide-react";

function fmt(d: string) {
  // Manual Wall-Clock Fix: Add 3 hours to the stored UTC time to get the original EAT input
  const date = new Date(d);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Nairobi",
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

export default function DashboardPage() {
  const { data: polls = [], isLoading } = useListPolls();
  const safePolls = (polls as any[]).filter(Boolean);

  const groups = {
    active: safePolls.filter((p: any) => p.status === "active"),
    upcoming: safePolls.filter((p: any) => p.status === "upcoming"),
    closed: safePolls.filter((p: any) => p.status === "closed"),
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          All polls you are eligible to vote in.
        </p>
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

      {!isLoading && safePolls.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            No polls available yet. Check back soon.
          </CardContent>
        </Card>
      )}

      {(["active", "upcoming", "closed"] as const).map(
        (g) =>
          groups[g].length > 0 && (
            <section key={g} className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xl font-semibold capitalize">
                  {g === "active" ? "Open for voting" : g}
                </h2>
                <Badge variant="outline" className="text-[10px]">
                  {groups[g].length}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups[g].map((p: any, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                  >
                    <Card className="h-full border-border/80 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
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
                      <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-3.5 w-3.5" /> Opens:{" "}
                          {fmt(p.startDate)}
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-3.5 w-3.5" /> Closes:{" "}
                          {fmt(p.endDate)}
                        </div>
                        <div className="pt-1.5">
                          {p.voted ? (
                            <Badge
                              className="bg-primary/15 text-primary border-primary/30"
                              variant="outline"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Vote
                              recorded
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {p.votedSeats}/{p.eligibleSeats} seats voted
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="gap-2">
                        {p.status === "active" && !p.voted && (
                          <Link href={`/vote/${p.id}`} className="w-full">
                            <Button className="w-full gap-1">
                              <Vote className="h-4 w-4" /> Cast vote
                            </Button>
                          </Link>
                        )}
                        {p.status === "active" && p.voted && (
                          <Button variant="outline" className="w-full" disabled>
                            You have voted
                          </Button>
                        )}
                        {p.status === "closed" && (
                          <Link href={`/results/${p.id}`} className="w-full">
                            <Button variant="outline" className="w-full gap-1">
                              <BarChart3 className="h-4 w-4" /> View results
                            </Button>
                          </Link>
                        )}
                        {p.status === "upcoming" && (
                          <Button variant="outline" className="w-full" disabled>
                            Opens {fmt(p.startDate)}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}
