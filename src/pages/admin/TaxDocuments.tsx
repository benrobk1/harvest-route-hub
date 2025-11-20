import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, FileText, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TaxDocuments() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear.toString());
  const [generating, setGenerating] = useState(false);

  const { data: eligibleUsers } = useQuery({
    queryKey: ["tax-eligible-users", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, w9_submitted_at")
        .not("w9_submitted_at", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const handleGenerateAll = async () => {
    if (!eligibleUsers || eligibleUsers.length === 0) {
      toast.error("No eligible users found with W-9 on file");
      return;
    }

    setGenerating(true);
    let successCount = 0;
    let errorCount = 0;

    for (const user of eligibleUsers) {
      try {
        const { error } = await supabase.functions.invoke("generate-1099", {
          body: { userId: user.id, year: parseInt(year) },
        });

        if (error) throw error;
        successCount++;
      } catch (error: unknown) {
        console.error(`Failed to generate 1099 for ${user.full_name}:`, error);
        errorCount++;
      }
    }

    setGenerating(false);
    
    if (successCount > 0) {
      toast.success(`Generated ${successCount} 1099 form(s)`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to generate ${errorCount} form(s)`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Tax Documents</h1>
          <p className="text-sm text-muted-foreground">
            Generate IRS Form 1099-NEC for eligible users
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate 1099-NEC Forms
            </CardTitle>
            <CardDescription>
              Generate tax forms for all users who have submitted W-9 information and earned over $600
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Forms will only be generated for users who have:
                <ul className="list-disc list-inside mt-2">
                  <li>Submitted W-9 information</li>
                  <li>Earned $600 or more in the selected year</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex items-end gap-4">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Tax Year</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(5)].map((_, i) => {
                      const y = currentYear - i;
                      return (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerateAll} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate All Forms
                  </>
                )}
              </Button>
            </div>

            {eligibleUsers && (
              <div className="text-sm text-muted-foreground">
                {eligibleUsers.length} user(s) eligible for 1099 generation
              </div>
            )}
          </CardContent>
        </Card>

        {/* Eligible Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Eligible Users</CardTitle>
            <CardDescription>Users who have submitted W-9 information</CardDescription>
          </CardHeader>
          <CardContent>
            {eligibleUsers && eligibleUsers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>W-9 Submitted</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {new Date(user.w9_submitted_at!).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <FileText className="h-3 w-3 mr-1" />
                          W-9 on File
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No users with W-9 information on file
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
