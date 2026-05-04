import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/?signin=1&next=/clients/new");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">New client</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Add a new client to your tracker. You can log weekly updates for them right after.
        </p>
      </header>
      <Card>
        <CardTitle as="h2">Client details</CardTitle>
        <CardDescription>Required fields are marked with an asterisk.</CardDescription>
        <div className="mt-4">
          <ClientForm />
        </div>
      </Card>
    </div>
  );
}
