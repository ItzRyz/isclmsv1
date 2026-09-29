import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Study Club LMS</CardTitle>
          <CardDescription>Bootstrap P0-003 s/d P0-005 OK</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge>Next 16.3.6</Badge>
          <Badge variant="secondary">Bun + Node 24</Badge>
          <Badge variant="outline">Mira / Zinc / Indigo</Badge>
          <Button>Mulai</Button>
          <ThemeToggle />
        </CardContent>
      </Card>
    </main>
  );
}
